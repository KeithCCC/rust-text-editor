use atomicwrites::{AllowOverwrite, AtomicFile};
use std::io::Write;
use std::path::Path;

pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to prepare directory '{}': {error}",
                parent.display()
            )
        })?;
    }

    AtomicFile::new(path, AllowOverwrite)
        .write(|file| {
            file.write_all(bytes)?;
            file.sync_all()
        })
        .map_err(|error| format!("Failed to atomically write '{}': {error}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::write_atomic;
    use std::fs;

    #[test]
    fn creates_and_replaces_a_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("note.md");

        write_atomic(&path, b"first").unwrap();
        write_atomic(&path, b"second").unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"second");
    }

    #[test]
    fn leaves_an_existing_directory_untouched_when_replacement_fails() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("note.md");
        fs::create_dir(&path).unwrap();

        assert!(write_atomic(&path, b"content").is_err());
        assert!(path.is_dir());
    }
}
