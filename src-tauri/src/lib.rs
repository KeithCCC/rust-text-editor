mod atomic_write;
mod recovery;

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::panic;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

use serde::Serialize;

#[derive(Serialize)]
struct TextFile {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileProperties {
    path: String,
    size: u64,
    created_ms: Option<u64>,
    modified_ms: Option<u64>,
}

#[tauri::command]
fn read_text_file(path: String) -> Result<TextFile, String> {
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read '{}': {}", path, error))?;

    Ok(TextFile { path, content })
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    atomic_write::write_atomic(Path::new(&path), content.as_bytes())
}

#[tauri::command]
fn write_binary_file(path: String, content: Vec<u8>) -> Result<(), String> {
    atomic_write::write_atomic(Path::new(&path), &content)
}

#[tauri::command]
fn get_file_properties(path: String) -> Result<FileProperties, String> {
    let normalized = normalize_path(PathBuf::from(&path))
        .map_err(|error| format!("Failed to resolve file path '{}': {}", path, error))?;
    let metadata = fs::metadata(&normalized).map_err(|error| {
        format!(
            "Failed to read metadata for '{}': {}",
            normalized.display(),
            error
        )
    })?;

    Ok(FileProperties {
        path: normalized.to_string_lossy().to_string(),
        size: metadata.len(),
        created_ms: metadata.created().ok().and_then(system_time_to_epoch_ms),
        modified_ms: metadata.modified().ok().and_then(system_time_to_epoch_ms),
    })
}

#[tauri::command]
fn open_file_in_new_instance(path: String) -> Result<(), String> {
    let normalized = normalize_path(PathBuf::from(&path))
        .map_err(|error| format!("Failed to resolve file path '{}': {}", path, error))?;
    if !normalized.is_file() {
        return Err(format!("'{}' is not a file", normalized.display()));
    }

    let exe_path = std::env::current_exe()
        .map_err(|error| format!("Failed to resolve executable path: {}", error))?;
    Command::new(exe_path)
        .arg(&normalized)
        .spawn()
        .map(|_| ())
        .map_err(|error| {
            format!(
                "Failed to open '{}' in a new instance: {}",
                normalized.display(),
                error
            )
        })
}

#[tauri::command]
fn get_startup_file_path() -> Result<Option<String>, String> {
    startup_file_path_from_args(std::env::args_os())
        .map(|path| path.map(|path| path.to_string_lossy().to_string()))
        .map_err(|error| format!("Failed to resolve startup file path: {}", error))
}

fn startup_file_path_from_args(
    args: impl IntoIterator<Item = std::ffi::OsString>,
) -> std::io::Result<Option<PathBuf>> {
    for arg in args.into_iter().skip(1) {
        let path = PathBuf::from(arg);
        if path.is_file() {
            return normalize_path(path).map(Some);
        }
    }

    Ok(None)
}

fn system_time_to_epoch_ms(time: std::time::SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}

#[tauri::command]
fn read_excalidraw_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read Excalidraw file '{}': {}", path, error))
}

#[tauri::command]
fn write_excalidraw_file(path: String, content: String) -> Result<(), String> {
    atomic_write::write_atomic(Path::new(&path), content.as_bytes())
}

#[tauri::command]
fn append_debug_log(level: String, message: String, details: Option<String>) -> Result<(), String> {
    let details = details.unwrap_or_default();
    write_debug_log(&format!("[frontend:{level}] {message}\n{details}"))
        .map_err(|error| format!("Failed to write debug log: {}", error))
}

#[tauri::command]
fn get_debug_log_path() -> Result<String, String> {
    debug_log_path()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("Failed to resolve debug log path: {}", error))
}

#[tauri::command]
fn resolve_relative_path(base_file: String, relative_path: String) -> Result<String, String> {
    let relative = Path::new(&relative_path);
    let resolved = if relative.is_absolute() {
        relative.to_path_buf()
    } else {
        let base = Path::new(&base_file);
        let parent = base
            .parent()
            .ok_or_else(|| format!("'{}' has no parent directory", base_file))?;
        parent.join(relative)
    };

    normalize_path(resolved)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("Failed to resolve '{}': {}", relative_path, error))
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    let _ = write_debug_log("[rust:exit] application exit requested");
    app.exit(0);
}

fn normalize_path(path: PathBuf) -> std::io::Result<PathBuf> {
    if path.exists() {
        path.canonicalize()
    } else if let Some(parent) = path.parent() {
        let parent = parent.canonicalize()?;
        Ok(parent.join(path.file_name().unwrap_or_default()))
    } else {
        Ok(path)
    }
}

fn debug_log_path() -> std::io::Result<PathBuf> {
    let exe_path = std::env::current_exe()?;
    let exe_dir = exe_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(std::env::temp_dir);
    Ok(exe_dir.join("debug.log"))
}

fn write_debug_log(message: &str) -> std::io::Result<()> {
    let path = debug_log_path()?;
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(file, "---- {:?} ----", std::time::SystemTime::now())?;
    writeln!(file, "{message}")?;
    Ok(())
}

fn install_panic_logger() {
    panic::set_hook(Box::new(|panic_info| {
        let location = panic_info
            .location()
            .map(|location| format!("{}:{}", location.file(), location.line()))
            .unwrap_or_else(|| "unknown location".to_string());

        let payload = panic_info
            .payload()
            .downcast_ref::<&str>()
            .map(|message| (*message).to_string())
            .or_else(|| {
                panic_info
                    .payload()
                    .downcast_ref::<String>()
                    .map(std::string::ToString::to_string)
            })
            .unwrap_or_else(|| "non-string panic payload".to_string());

        let _ = write_debug_log(&format!("[rust:panic] {payload}\nlocation: {location}"));
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_logger();
    let _ = write_debug_log("[rust:startup] application starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            write_binary_file,
            get_file_properties,
            open_file_in_new_instance,
            get_startup_file_path,
            read_excalidraw_file,
            write_excalidraw_file,
            append_debug_log,
            get_debug_log_path,
            resolve_relative_path,
            exit_app,
            recovery::read_recovery_draft,
            recovery::write_recovery_draft,
            recovery::delete_recovery_draft
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod binary_file_tests {
    use super::{startup_file_path_from_args, write_binary_file};
    use std::ffi::OsString;

    #[test]
    fn writes_binary_export_bytes() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("diagram.png");
        write_binary_file(path.to_string_lossy().to_string(), vec![0, 1, 2, 255]).expect("write");
        assert_eq!(std::fs::read(path).expect("read"), vec![0, 1, 2, 255]);
    }

    #[test]
    fn selects_existing_file_from_startup_arguments() {
        let directory = tempfile::tempdir().expect("tempdir");
        let markdown_path = directory.path().join("notes with spaces.md");
        std::fs::write(&markdown_path, "# Opened from Explorer").expect("fixture");
        let args = vec![
            OsString::from("koharu.exe"),
            OsString::from("--ignored"),
            markdown_path.clone().into_os_string(),
        ];

        let selected = startup_file_path_from_args(args).expect("startup path");

        assert_eq!(selected, Some(markdown_path.canonicalize().expect("canonical path")));
    }
}
