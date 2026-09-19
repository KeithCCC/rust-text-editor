use base64::{Engine, engine::general_purpose::STANDARD};
use std::path::Path;

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;

/// Embed referenced images without relying on browser CORS permissions or cookies.
#[tauri::command]
pub async fn read_pdf_image(current_file: Option<String>, src: String) -> Result<String, String> {
    if let Ok(url) = reqwest::Url::parse(&src) {
        if matches!(url.scheme(), "http" | "https") {
            return read_remote_image(url).await;
        }
    }
    let current_file = current_file.ok_or("Save the document before exporting relative images")?;
    tauri::async_runtime::spawn_blocking(move || read_local_image(&current_file, &src))
        .await
        .map_err(|error| error.to_string())?
}

async fn read_remote_image(url: reqwest::Url) -> Result<String, String> {
    use std::time::Duration;
    if !url.username().is_empty() || url.password().is_some() {
        return Err("PDF image URLs must not include credentials".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .connect_timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 {
                attempt.error("Too many image redirects")
            } else if !matches!(attempt.url().scheme(), "http" | "https")
                || !attempt.url().username().is_empty()
                || attempt.url().password().is_some()
            {
                attempt.error("Unsupported image redirect")
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|error| error.to_string())?;
    let mut response = client
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| format!("Failed to download PDF image: {error}"))?;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_IMAGE_BYTES as u64)
    {
        return Err("PDF image exceeds 10 MB".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if bytes.len() + chunk.len() > MAX_IMAGE_BYTES {
            return Err("PDF image exceeds 10 MB".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    image_data_uri(&bytes)
}

fn read_local_image(current_file: &str, src: &str) -> Result<String, String> {
    use std::io::Read;
    let relative = Path::new(&src);
    if relative.is_absolute() || src.contains(':') {
        return Err("PDF images must use a relative path".into());
    }
    let parent = Path::new(&current_file)
        .parent()
        .ok_or("Document has no parent directory")?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let path = parent
        .join(relative)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    std::fs::File::open(&path)
        .map_err(|e| e.to_string())?
        .take(MAX_IMAGE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err("PDF image exceeds 10 MB".into());
    }
    image_data_uri(&bytes)
}

fn image_data_uri(bytes: &[u8]) -> Result<String, String> {
    let mime = match bytes {
        bytes if bytes.starts_with(b"\x89PNG\r\n\x1a\n") => "image/png",
        bytes if bytes.starts_with(&[0xff, 0xd8, 0xff]) => "image/jpeg",
        bytes if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") => "image/gif",
        bytes if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") => "image/webp",
        bytes if std::str::from_utf8(bytes).is_ok_and(|text| text.contains("<svg")) => {
            "image/svg+xml"
        }
        _ => return Err("Unsupported PDF image format".into()),
    };
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

#[tauri::command]
pub async fn export_pdf(app: tauri::AppHandle, html: String, path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || windows_export(app, html, path))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (app, html, path);
        Err("PDF export currently requires Windows WebView2".into())
    }
}

#[cfg(windows)]
fn windows_export(app: tauri::AppHandle, html: String, path: String) -> Result<(), String> {
    use std::sync::{
        atomic::{AtomicU64, Ordering},
        mpsc,
    };
    use std::time::{Duration, Instant};
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_7, ICoreWebView2Environment6,
    };
    use webview2_com::{ExecuteScriptCompletedHandler, PrintToPdfCompletedHandler};
    use windows::core::{HSTRING, Interface};

    static NEXT_ID: AtomicU64 = AtomicU64::new(0);
    let temporary = tempfile::tempdir().map_err(|e| e.to_string())?;
    let html_path = temporary.path().join("document.html");
    let pdf_path = temporary.path().join("document.pdf");
    // Printing never needs scripts, network access, or access to other local files.
    let policy = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none';\">";
    let secured_html = if let Some(index) = html.find('>') {
        // Put the policy before any user content, even when the input begins with a doctype.
        format!("{}{}{}", &html[..=index], policy, &html[index + 1..])
    } else {
        return Err("Invalid PDF HTML document".into());
    };
    std::fs::write(&html_path, secured_html).map_err(|e| e.to_string())?;
    let url = tauri::Url::from_file_path(&html_path).map_err(|_| "Invalid PDF temporary path")?;
    let allowed_url = url.clone();
    let window = WebviewWindowBuilder::new(
        &app,
        format!("pdf-export-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed)),
        WebviewUrl::External(url),
    )
    .title("PDF export")
    .visible(false)
    .focused(false)
    .inner_size(794.0, 1123.0)
    .on_navigation(move |url| *url == allowed_url)
    .build()
    .map_err(|e| format!("Failed to create PDF renderer: {e}"))?;

    let result = (|| {
        let deadline = Instant::now() + Duration::from_secs(30);
        loop {
            let (sender, receiver) = mpsc::channel();
            window.with_webview(move |webview| {
                let error_sender = sender.clone();
                let result = unsafe {
                    webview.controller().CoreWebView2().and_then(|core| core.ExecuteScript(
                        &HSTRING::from("(() => { if (location.protocol !== 'file:' || document.readyState !== 'complete' || !document.body || document.fonts.status !== 'loaded') return false; const images = Array.from(document.images); if (images.some(image => image.complete && image.naturalWidth === 0)) return 'broken-image'; return images.every(image => image.complete); })()"),
                        &ExecuteScriptCompletedHandler::create(Box::new(move |status, value| {
                            let result = status.map_err(|e| e.to_string()).and_then(|_| {
                                if value == "\"broken-image\"" {
                                    Err("A PDF image could not be loaded".into())
                                } else {
                                    Ok(value == "true")
                                }
                            });
                            let _ = sender.send(result);
                            Ok(())
                        })),
                    ))
                };
                if let Err(error) = result { let _ = error_sender.send(Err(error.to_string())); }
            }).map_err(|e| e.to_string())?;
            if receiver
                .recv_timeout(Duration::from_secs(5))
                .map_err(|_| "PDF renderer did not respond")??
            {
                break;
            }
            if Instant::now() >= deadline {
                return Err("PDF document did not finish loading".into());
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        let (sender, receiver) = mpsc::channel();
        let output = pdf_path.clone();
        window
            .with_webview(move |webview| {
                let error_sender = sender.clone();
                let result = (|| -> windows::core::Result<()> {
                    unsafe {
                        let core: ICoreWebView2_7 = webview.controller().CoreWebView2()?.cast()?;
                        let environment: ICoreWebView2Environment6 =
                            webview.environment().cast()?;
                        let settings = environment.CreatePrintSettings()?;
                        settings.SetPageWidth(210.0 / 25.4)?;
                        settings.SetPageHeight(297.0 / 25.4)?;
                        settings.SetShouldPrintBackgrounds(true)?;
                        settings.SetShouldPrintHeaderAndFooter(false)?;
                        core.PrintToPdf(
                            &HSTRING::from(output.as_os_str()),
                            &settings,
                            &PrintToPdfCompletedHandler::create(Box::new(
                                move |status, success| {
                                    let result = status.map_err(|e| e.to_string()).and_then(|_| {
                                        if success {
                                            Ok(())
                                        } else {
                                            Err("WebView2 failed to create the PDF".into())
                                        }
                                    });
                                    let _ = sender.send(result);
                                    Ok(())
                                },
                            )),
                        )
                    }
                })();
                if let Err(error) = result {
                    let _ = error_sender.send(Err(error.to_string()));
                }
            })
            .map_err(|e| e.to_string())?;
        receiver
            .recv_timeout(Duration::from_secs(90))
            .map_err(|_| "PDF export timed out")??;
        let bytes = std::fs::read(&pdf_path).map_err(|e| e.to_string())?;
        if !bytes.starts_with(b"%PDF-") {
            return Err("Renderer returned an invalid PDF".into());
        }
        crate::atomic_write::write_atomic(Path::new(&path), &bytes)
    })();
    let _ = window.destroy();
    result
}

#[cfg(test)]
mod tests {
    use super::read_pdf_image;

    fn serve_image(body: Vec<u8>) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/image", listener.local_addr().unwrap());
        std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                .unwrap();
            let mut request = [0_u8; 4096];
            let count = stream.read(&mut request).unwrap();
            assert!(
                !String::from_utf8_lossy(&request[..count])
                    .to_ascii_lowercase()
                    .contains("cookie:")
            );
            // Deliberately omit both CORS and Content-Length to exercise the stream limit.
            let _ = stream.write_all(
                b"HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nConnection: close\r\n\r\n",
            );
            let _ = stream.write_all(&body);
        });
        url
    }

    #[test]
    fn reads_remote_image_without_cors_headers() {
        let url = serve_image(b"\x89PNG\r\n\x1a\nfixture".to_vec());
        assert!(
            tauri::async_runtime::block_on(read_pdf_image(None, url))
                .unwrap()
                .starts_with("data:image/png;base64,")
        );
    }

    #[test]
    fn limits_remote_image_stream_without_content_length() {
        let mut body = b"\x89PNG\r\n\x1a\n".to_vec();
        body.resize(super::MAX_IMAGE_BYTES + 1, 0);
        let url = serve_image(body);
        let error = tauri::async_runtime::block_on(read_pdf_image(None, url)).unwrap_err();
        assert!(error.contains("exceeds 10 MB"), "{error}");
    }

    #[test]
    fn rejects_remote_non_image_body() {
        let url = serve_image(b"<html>not an image</html>".to_vec());
        assert!(
            tauri::async_runtime::block_on(read_pdf_image(None, url))
                .unwrap_err()
                .contains("Unsupported PDF image format")
        );
    }

    #[test]
    fn embeds_relative_images_including_parent_paths_and_rejects_disguised_files() {
        let root = tempfile::tempdir().unwrap();
        let document_dir = root.path().join("docs");
        std::fs::create_dir(&document_dir).unwrap();
        std::fs::write(document_dir.join("image.png"), b"\x89PNG\r\n\x1a\nfixture").unwrap();
        std::fs::write(document_dir.join("fake.png"), b"not an image").unwrap();
        std::fs::write(root.path().join("outside.png"), b"\x89PNG\r\n\x1a\nfixture").unwrap();
        let current = document_dir.join("note.md").to_string_lossy().to_string();
        assert!(
            tauri::async_runtime::block_on(read_pdf_image(
                Some(current.clone()),
                "image.png".into()
            ))
            .unwrap()
            .starts_with("data:image/png;base64,")
        );
        assert!(
            tauri::async_runtime::block_on(read_pdf_image(
                Some(current.clone()),
                "fake.png".into()
            ))
            .is_err()
        );
        assert!(
            tauri::async_runtime::block_on(read_pdf_image(Some(current), "../outside.png".into()))
                .unwrap()
                .starts_with("data:image/png;base64,")
        );
    }
}
