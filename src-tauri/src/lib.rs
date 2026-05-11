use std::fs::{self, OpenOptions};
use std::io::Write;
use std::panic;
use std::path::{Path, PathBuf};

use serde::Serialize;

const VAULT_DIR_NAME: &str = "hotaru-valut";

#[derive(Serialize)]
struct TextFile {
    path: String,
    content: String,
}

#[tauri::command]
fn read_text_file(path: String) -> Result<TextFile, String> {
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read '{}': {}", path, error))?;

    Ok(TextFile { path, content })
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to prepare directory for '{}': {}", path, error))?;
    }

    fs::write(&path, content).map_err(|error| format!("Failed to write '{}': {}", path, error))
}

#[tauri::command]
fn ensure_hotaru_vault(selected_dir: String) -> Result<String, String> {
    let selected = PathBuf::from(&selected_dir);
    let vault = if selected
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case(VAULT_DIR_NAME))
        .unwrap_or(false)
    {
        selected
    } else {
        selected.join(VAULT_DIR_NAME)
    };

    prepare_hotaru_vault(vault)
}

#[tauri::command]
fn ensure_default_hotaru_vault() -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("Failed to resolve executable path: {}", error))?;
    let exe_dir = exe_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Executable path has no parent directory".to_string())?;

    prepare_hotaru_vault(exe_dir.join(VAULT_DIR_NAME))
}

fn prepare_hotaru_vault(vault: PathBuf) -> Result<String, String> {
    fs::create_dir_all(&vault).map_err(|error| {
        format!(
            "Failed to create Hotaru vault '{}': {}",
            vault.display(),
            error
        )
    })?;

    normalize_path(vault)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("Failed to resolve Hotaru vault: {}", error))
}

#[tauri::command]
fn create_vault_note(vault_path: String, content: String) -> Result<TextFile, String> {
    let vault = PathBuf::from(&vault_path);
    fs::create_dir_all(&vault).map_err(|error| {
        format!(
            "Failed to prepare Hotaru vault '{}': {}",
            vault.display(),
            error
        )
    })?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("Failed to create note timestamp: {}", error))?
        .as_secs();

    for index in 0..100 {
        let file_name = if index == 0 {
            format!("hotaru-note-{timestamp}.md")
        } else {
            format!("hotaru-note-{timestamp}-{index}.md")
        };
        let path = vault.join(file_name);

        if !path.exists() {
            fs::write(&path, &content).map_err(|error| {
                format!(
                    "Failed to create vault note '{}': {}",
                    path.display(),
                    error
                )
            })?;

            return normalize_path(path)
                .map(|path| TextFile {
                    path: path.to_string_lossy().to_string(),
                    content,
                })
                .map_err(|error| format!("Failed to resolve vault note: {}", error));
        }
    }

    Err("Failed to create a unique Hotaru vault note name".to_string())
}

#[tauri::command]
fn get_startup_file_path() -> Result<Option<String>, String> {
    let mut args = std::env::args_os();
    let _ = args.next();

    for arg in args {
        let path = PathBuf::from(arg);
        if path.is_file() {
            return normalize_path(path)
                .map(|path| Some(path.to_string_lossy().to_string()))
                .map_err(|error| format!("Failed to resolve startup file path: {}", error));
        }
    }

    Ok(None)
}

#[tauri::command]
fn read_excalidraw_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read Excalidraw file '{}': {}", path, error))
}

#[tauri::command]
fn write_excalidraw_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|error| format!("Failed to write Excalidraw file '{}': {}", path, error))
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
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            ensure_hotaru_vault,
            ensure_default_hotaru_vault,
            create_vault_note,
            get_startup_file_path,
            read_excalidraw_file,
            write_excalidraw_file,
            append_debug_log,
            get_debug_log_path,
            resolve_relative_path,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
