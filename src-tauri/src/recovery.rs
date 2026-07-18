use crate::atomic_write::write_atomic;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryDraft {
    pub schema_version: u8,
    pub document_path: Option<String>,
    pub content: String,
    pub updated_ms: u64,
}

fn draft_path(base: &Path) -> PathBuf {
    base.join("recovery").join("active-draft.json")
}

pub fn write_at(base: &Path, draft: &RecoveryDraft) -> Result<(), String> {
    let bytes = serde_json::to_vec(draft)
        .map_err(|error| format!("Failed to serialize recovery draft: {error}"))?;
    write_atomic(&draft_path(base), &bytes)
}

pub fn read_at(base: &Path) -> Result<Option<RecoveryDraft>, String> {
    let path = draft_path(base);
    let bytes = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Failed to read recovery draft: {error}")),
    };
    let draft: RecoveryDraft = match serde_json::from_slice(&bytes) {
        Ok(draft) => draft,
        Err(error) => {
            let _ = delete_at(base);
            return Err(format!(
                "Failed to parse recovery draft; the invalid draft was removed: {error}"
            ));
        }
    };

    if draft.schema_version != 1 {
        let schema = draft.schema_version;
        let _ = delete_at(base);
        return Err(format!(
            "Unsupported recovery draft schema {schema}; the draft was removed"
        ));
    }

    if let Some(document_path) = &draft.document_path {
        if fs::read_to_string(document_path).ok().as_deref() == Some(draft.content.as_str()) {
            delete_at(base)?;
            return Ok(None);
        }
    }

    Ok(Some(draft))
}

pub fn delete_at(base: &Path) -> Result<(), String> {
    match fs::remove_file(draft_path(base)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to delete recovery draft: {error}")),
    }
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve Koharu app-data directory: {error}"))
}

#[tauri::command]
pub fn read_recovery_draft(app: AppHandle) -> Result<Option<RecoveryDraft>, String> {
    read_at(&app_data_dir(&app)?)
}

#[tauri::command]
pub fn write_recovery_draft(app: AppHandle, draft: RecoveryDraft) -> Result<(), String> {
    write_at(&app_data_dir(&app)?, &draft)
}

#[tauri::command]
pub fn delete_recovery_draft(app: AppHandle) -> Result<(), String> {
    delete_at(&app_data_dir(&app)?)
}

#[cfg(test)]
mod tests {
    use super::{RecoveryDraft, delete_at, draft_path, read_at, write_at};
    use std::fs;

    fn draft(path: Option<String>, content: &str) -> RecoveryDraft {
        RecoveryDraft {
            schema_version: 1,
            document_path: path,
            content: content.to_string(),
            updated_ms: 42,
        }
    }

    #[test]
    fn round_trips_and_deletes_a_draft() {
        let dir = tempfile::tempdir().unwrap();
        let expected = draft(None, "unsaved");

        write_at(dir.path(), &expected).unwrap();
        assert_eq!(read_at(dir.path()).unwrap(), Some(expected));

        delete_at(dir.path()).unwrap();
        assert_eq!(read_at(dir.path()).unwrap(), None);
    }

    #[test]
    fn filters_a_draft_that_matches_the_saved_file() {
        let dir = tempfile::tempdir().unwrap();
        let document = dir.path().join("saved.md");
        fs::write(&document, "same").unwrap();
        write_at(
            dir.path(),
            &draft(Some(document.to_string_lossy().to_string()), "same"),
        )
        .unwrap();

        assert_eq!(read_at(dir.path()).unwrap(), None);
    }

    #[test]
    fn preserves_a_draft_that_differs_from_the_saved_file() {
        let dir = tempfile::tempdir().unwrap();
        let document = dir.path().join("saved.md");
        fs::write(&document, "disk").unwrap();
        let expected = draft(Some(document.to_string_lossy().to_string()), "draft");
        write_at(dir.path(), &expected).unwrap();

        assert_eq!(read_at(dir.path()).unwrap(), Some(expected));
    }

    #[test]
    fn removes_an_invalid_draft_after_reporting_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = draft_path(dir.path());
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"not json").unwrap();

        assert!(read_at(dir.path()).is_err());
        assert!(!path.exists());
    }
}
