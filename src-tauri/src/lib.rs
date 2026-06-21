use std::fs::{self, OpenOptions};
use std::io::Write;
use std::panic;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

use serde::Serialize;

const VAULT_DIR_NAME: &str = "hotaru-valut";

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultFile {
    path: String,
    relative_path: String,
    name: String,
    extension: String,
    size: u64,
    created_ms: Option<u64>,
    modified_ms: Option<u64>,
    is_draft: bool,
    tags: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Backlink {
    path: String,
    relative_path: String,
    name: String,
    matches: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultSearchMatch {
    path: String,
    relative_path: String,
    name: String,
    line_number: usize,
    line_text: String,
    line_match_start: usize,
    line_match_end: usize,
    match_start: usize,
    match_end: usize,
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
    prepare_hotaru_vault(PathBuf::from(&selected_dir))
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
fn create_named_vault_note(vault_path: String, relative_path: String, content: String) -> Result<TextFile, String> {
    let vault = normalize_path(PathBuf::from(&vault_path))
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault_path, error))?;
    fs::create_dir_all(&vault).map_err(|error| {
        format!(
            "Failed to prepare Hotaru vault '{}': {}",
            vault.display(),
            error
        )
    })?;

    let path = resolve_vault_child(&vault, &relative_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to prepare note folder '{}': {}", parent.display(), error))?;
    }
    if path.exists() {
        return Err(format!("Vault note '{}' already exists", path.display()));
    }

    fs::write(&path, &content)
        .map_err(|error| format!("Failed to create vault note '{}': {}", path.display(), error))?;

    Ok(TextFile {
        path: path.to_string_lossy().to_string(),
        content,
    })
}

#[tauri::command]
fn get_file_properties(path: String) -> Result<FileProperties, String> {
    let normalized = normalize_path(PathBuf::from(&path))
        .map_err(|error| format!("Failed to resolve file path '{}': {}", path, error))?;
    let metadata = fs::metadata(&normalized)
        .map_err(|error| format!("Failed to read metadata for '{}': {}", normalized.display(), error))?;

    Ok(FileProperties {
        path: normalized.to_string_lossy().to_string(),
        size: metadata.len(),
        created_ms: metadata.created().ok().and_then(system_time_to_epoch_ms),
        modified_ms: metadata.modified().ok().and_then(system_time_to_epoch_ms),
    })
}

#[tauri::command]
fn list_vault_files(vault_path: String) -> Result<Vec<VaultFile>, String> {
    let vault = normalize_path(PathBuf::from(&vault_path))
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault_path, error))?;
    let mut files = Vec::new();
    collect_vault_files(&vault, &vault, &mut files)?;
    files.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(files)
}

#[tauri::command]
fn rename_vault_file(vault_path: String, path: String, new_relative_path: String) -> Result<TextFile, String> {
    let vault = normalize_path(PathBuf::from(&vault_path))
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault_path, error))?;
    let source = resolve_existing_vault_file(&vault, &path)?;
    let target = resolve_vault_child(&vault, &new_relative_path)?;

    if target.exists() {
        return Err(format!("Vault file '{}' already exists", target.display()));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to prepare rename folder '{}': {}", parent.display(), error))?;
    }

    fs::rename(&source, &target).map_err(|error| {
        format!(
            "Failed to rename '{}' to '{}': {}",
            source.display(),
            target.display(),
            error
        )
    })?;

    let content = fs::read_to_string(&target)
        .map_err(|error| format!("Failed to read renamed file '{}': {}", target.display(), error))?;
    Ok(TextFile {
        path: target.to_string_lossy().to_string(),
        content,
    })
}

#[tauri::command]
fn delete_vault_file(vault_path: String, path: String) -> Result<(), String> {
    let vault = normalize_path(PathBuf::from(&vault_path))
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault_path, error))?;
    let target = resolve_existing_vault_file(&vault, &path)?;
    if !target.is_file() {
        return Err(format!("'{}' is not a file", target.display()));
    }

    fs::remove_file(&target)
        .map_err(|error| format!("Failed to delete vault file '{}': {}", target.display(), error))
}

#[tauri::command]
fn duplicate_vault_file(vault_path: String, path: String) -> Result<TextFile, String> {
    let vault = normalize_path(PathBuf::from(&vault_path))
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault_path, error))?;
    let source = resolve_existing_vault_file(&vault, &path)?;
    if !source.is_file() {
        return Err(format!("'{}' is not a file", source.display()));
    }

    let target = unique_copy_path(&source)?;
    fs::copy(&source, &target).map_err(|error| {
        format!(
            "Failed to duplicate '{}' to '{}': {}",
            source.display(),
            target.display(),
            error
        )
    })?;
    let content = fs::read_to_string(&target)
        .map_err(|error| format!("Failed to read duplicated file '{}': {}", target.display(), error))?;
    Ok(TextFile {
        path: target.to_string_lossy().to_string(),
        content,
    })
}

#[tauri::command]
fn get_vault_backlinks(vault_path: String, current_path: String) -> Result<Vec<Backlink>, String> {
    let vault = normalize_path(PathBuf::from(&vault_path))
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault_path, error))?;
    let current = resolve_existing_vault_file(&vault, &current_path)?;
    scan_vault_backlinks(&vault, &current)
}

#[tauri::command]
fn search_vault_text(vault_path: String, query: String, limit: Option<usize>) -> Result<Vec<VaultSearchMatch>, String> {
    let vault = normalize_path(PathBuf::from(&vault_path))
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault_path, error))?;
    scan_vault_text(&vault, &query, limit.unwrap_or(200))
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
        .map_err(|error| format!("Failed to open '{}' in a new instance: {}", normalized.display(), error))
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

fn collect_vault_files(root: &Path, current: &Path, files: &mut Vec<VaultFile>) -> Result<(), String> {
    for entry in fs::read_dir(current)
        .map_err(|error| format!("Failed to list vault folder '{}': {}", current.display(), error))?
    {
        let entry = entry.map_err(|error| format!("Failed to read vault entry: {}", error))?;
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Failed to read metadata for '{}': {}", path.display(), error))?;

        if metadata.is_dir() {
            collect_vault_files(root, &path, files)?;
            continue;
        }

        if metadata.is_file() {
            let name = path
                .strip_prefix(root)
                .unwrap_or(path.as_path())
                .to_string_lossy()
                .to_string();
            let extension = path
                .extension()
                .and_then(|extension| extension.to_str())
                .unwrap_or_default()
                .to_string();
            let tags = if is_markdown_extension(&extension) {
                fs::read_to_string(&path)
                    .map(|content| extract_tags(&content))
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            let normalized = normalize_path(path.clone())
                .map_err(|error| format!("Failed to resolve vault file path: {}", error))?;
            files.push(VaultFile {
                path: normalized.to_string_lossy().to_string(),
                relative_path: name.clone(),
                name: path
                    .file_name()
                    .and_then(|file_name| file_name.to_str())
                    .unwrap_or(&name)
                    .to_string(),
                extension,
                size: metadata.len(),
                created_ms: metadata.created().ok().and_then(system_time_to_epoch_ms),
                modified_ms: metadata.modified().ok().and_then(system_time_to_epoch_ms),
                is_draft: is_draft_vault_file(&name),
                tags,
            });
        }
    }

    Ok(())
}

fn resolve_vault_child(vault: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let vault = normalize_path(vault.to_path_buf())
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault.display(), error))?;
    let relative = Path::new(relative_path);
    if relative.is_absolute() {
        return Err("Vault paths must be relative".to_string());
    }

    for component in relative.components() {
        match component {
            Component::Normal(_) => {}
            _ => return Err(format!("Invalid vault-relative path '{}'", relative_path)),
        }
    }

    let candidate = vault.join(relative);
    let parent = candidate
        .parent()
        .ok_or_else(|| format!("'{}' has no parent directory", candidate.display()))?;
    let normalized_parent = if parent.exists() {
        parent
            .canonicalize()
            .map_err(|error| format!("Failed to resolve '{}': {}", parent.display(), error))?
    } else {
        let nearest_existing = nearest_existing_parent(parent)
            .ok_or_else(|| format!("No existing parent for '{}'", parent.display()))?;
        let normalized_existing = nearest_existing
            .canonicalize()
            .map_err(|error| format!("Failed to resolve '{}': {}", nearest_existing.display(), error))?;
        normalized_existing.join(parent.strip_prefix(nearest_existing).unwrap_or(Path::new("")))
    };

    if !normalized_parent.starts_with(&vault) {
        return Err(format!("Path '{}' is outside the Hotaru vault", relative_path));
    }

    Ok(normalized_parent.join(candidate.file_name().unwrap_or_default()))
}

fn resolve_existing_vault_file(vault: &Path, path: &str) -> Result<PathBuf, String> {
    let vault = normalize_path(vault.to_path_buf())
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault.display(), error))?;
    let normalized = normalize_path(PathBuf::from(path))
        .map_err(|error| format!("Failed to resolve file path '{}': {}", path, error))?;

    if !normalized.starts_with(&vault) {
        return Err(format!("Path '{}' is outside the Hotaru vault", path));
    }
    if !normalized.is_file() {
        return Err(format!("'{}' is not a file", normalized.display()));
    }

    Ok(normalized)
}

fn nearest_existing_parent(path: &Path) -> Option<&Path> {
    let mut current = path;
    loop {
        if current.exists() {
            return Some(current);
        }
        current = current.parent()?;
    }
}

fn unique_copy_path(source: &Path) -> Result<PathBuf, String> {
    let parent = source
        .parent()
        .ok_or_else(|| format!("'{}' has no parent directory", source.display()))?;
    let stem = source.file_stem().and_then(|stem| stem.to_str()).unwrap_or("copy");
    let extension = source.extension().and_then(|extension| extension.to_str());

    for index in 1..1000 {
        let file_name = match extension {
            Some(extension) if !extension.is_empty() => format!("{stem} copy {index}.{extension}"),
            _ => format!("{stem} copy {index}"),
        };
        let candidate = parent.join(file_name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!("Failed to find a unique duplicate name for '{}'", source.display()))
}

fn is_draft_vault_file(relative_path: &str) -> bool {
    let Some(name) = Path::new(relative_path).file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    let Some(rest) = name.strip_prefix("hotaru-note-") else {
        return false;
    };
    let Some(rest) = rest.strip_suffix(".md") else {
        return false;
    };
    let mut parts = rest.split('-');
    let Some(timestamp) = parts.next() else {
        return false;
    };
    if timestamp.is_empty() || !timestamp.chars().all(|character| character.is_ascii_digit()) {
        return false;
    }
    parts.all(|part| !part.is_empty() && part.chars().all(|character| character.is_ascii_digit()))
}

fn is_markdown_extension(extension: &str) -> bool {
    extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("markdown")
}

fn add_tag(tags: &mut Vec<String>, tag: &str) {
    let normalized = tag.trim().trim_start_matches('#').trim();
    if !is_valid_tag(normalized) {
        return;
    }
    if !tags.iter().any(|existing| existing.eq_ignore_ascii_case(normalized)) {
        tags.push(normalized.to_string());
    }
}

fn is_valid_tag(tag: &str) -> bool {
    !tag.is_empty()
        && tag
            .chars()
            .any(|character| !character.is_ascii_digit() && character != '/' && character != '-' && character != '_')
}

fn is_inline_tag_start(previous: Option<char>, next: Option<char>) -> bool {
    let Some(next) = next else {
        return false;
    };
    if !is_tag_character(next) {
        return false;
    }
    match previous {
        None => true,
        Some(character) => character.is_whitespace() || matches!(character, '(' | '[' | '{' | '"' | '\''),
    }
}

fn is_tag_character(character: char) -> bool {
    character.is_alphanumeric()
        || matches!(character, '_' | '-' | '/')
        || (!character.is_ascii() && !character.is_whitespace())
}

fn trim_inline_tag(tag: &str) -> &str {
    tag.trim_matches(|character: char| {
        matches!(
            character,
            '.' | ',' | ';' | ':' | '!' | '?' | ')' | ']' | '}' | '"' | '\''
        )
    })
}

fn extract_tags(content: &str) -> Vec<String> {
    let mut tags = Vec::new();
    extract_frontmatter_tags(content, &mut tags);
    extract_inline_tags(content, &mut tags);
    tags.sort_by_key(|tag| tag.to_lowercase());
    tags
}

fn extract_frontmatter_tags(content: &str, tags: &mut Vec<String>) {
    let mut lines = content.lines();
    if lines.next() != Some("---") {
        return;
    }

    let mut in_tags = false;
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }

        if let Some(value) = trimmed.strip_prefix("tags:") {
            in_tags = true;
            let value = value.trim();
            if value.starts_with('[') && value.ends_with(']') {
                for tag in value.trim_matches(|character| character == '[' || character == ']').split(',') {
                    add_tag(tags, tag.trim().trim_matches('"').trim_matches('\''));
                }
            } else if !value.is_empty() {
                add_tag(tags, value.trim_matches('"').trim_matches('\''));
            }
            continue;
        }

        if in_tags {
            if let Some(value) = trimmed.strip_prefix('-') {
                add_tag(tags, value.trim().trim_matches('"').trim_matches('\''));
            } else if !trimmed.is_empty() && !line.starts_with(' ') && !line.starts_with('\t') {
                in_tags = false;
            }
        }
    }
}

fn extract_inline_tags(content: &str, tags: &mut Vec<String>) {
    let mut in_code_fence = false;
    for line in content.lines() {
        if line.trim_start().starts_with("```") {
            in_code_fence = !in_code_fence;
            continue;
        }
        if in_code_fence {
            continue;
        }

        let characters: Vec<(usize, char)> = line.char_indices().collect();
        for (index, (byte_index, character)) in characters.iter().enumerate() {
            if *character != '#' {
                continue;
            }
            let previous = if index == 0 { None } else { Some(characters[index - 1].1) };
            let next = characters.get(index + 1).map(|(_, next)| *next);
            if !is_inline_tag_start(previous, next) {
                continue;
            }

            let start = *byte_index + character.len_utf8();
            let mut end = line.len();
            for (candidate, candidate_character) in line[start..].char_indices() {
                if !is_tag_character(candidate_character) {
                    end = start + candidate;
                    break;
                }
            }
            add_tag(tags, trim_inline_tag(&line[start..end]));
        }
    }
}

fn extract_wiki_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut remaining = content;

    while let Some(start) = remaining.find("[[") {
        remaining = &remaining[start + 2..];
        let Some(end) = remaining.find("]]") else {
            break;
        };
        let link = remaining[..end].trim();
        if !link.is_empty() && !links.iter().any(|existing| existing == link) {
            links.push(link.to_string());
        }
        remaining = &remaining[end + 2..];
    }

    links
}

fn scan_vault_backlinks(vault: &Path, current_path: &Path) -> Result<Vec<Backlink>, String> {
    let vault = normalize_path(vault.to_path_buf())
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault.display(), error))?;
    let current_stem = current_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| format!("Failed to read filename for '{}'", current_path.display()))?
        .to_lowercase();
    let mut files = Vec::new();
    collect_markdown_files(&vault, &mut files)?;
    let current = normalize_path(current_path.to_path_buf())
        .map_err(|error| format!("Failed to resolve current file '{}': {}", current_path.display(), error))?;
    let mut backlinks = Vec::new();

    for file in files {
        let normalized = normalize_path(file.clone())
            .map_err(|error| format!("Failed to resolve vault file '{}': {}", file.display(), error))?;
        if normalized == current {
            continue;
        }

        let content = fs::read_to_string(&normalized)
            .map_err(|error| format!("Failed to read vault file '{}': {}", normalized.display(), error))?;
        let matches: Vec<String> = extract_wiki_links(&content)
            .into_iter()
            .filter(|link| link.to_lowercase() == current_stem)
            .collect();

        if matches.is_empty() {
            continue;
        }

        let relative_path = normalized
            .strip_prefix(&vault)
            .unwrap_or(normalized.as_path())
            .to_string_lossy()
            .to_string();
        let name = normalized
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&relative_path)
            .to_string();
        backlinks.push(Backlink {
            path: normalized.to_string_lossy().to_string(),
            relative_path,
            name,
            matches,
        });
    }

    backlinks.sort_by(|left, right| left.relative_path.to_lowercase().cmp(&right.relative_path.to_lowercase()));
    Ok(backlinks)
}

fn scan_vault_text(vault: &Path, query: &str, limit: usize) -> Result<Vec<VaultSearchMatch>, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Err("Vault search query cannot be empty".to_string());
    }

    let vault = normalize_path(vault.to_path_buf())
        .map_err(|error| format!("Failed to resolve vault path '{}': {}", vault.display(), error))?;
    let normalized_query = trimmed_query.to_lowercase();
    let max_results = limit.clamp(1, 500);
    let mut files = Vec::new();
    collect_markdown_files(&vault, &mut files)?;
    files.sort_by_key(|file| file.to_string_lossy().to_lowercase());

    let mut results = Vec::new();
    for file in files {
        if results.len() >= max_results {
            break;
        }

        let normalized = normalize_path(file.clone())
            .map_err(|error| format!("Failed to resolve vault file '{}': {}", file.display(), error))?;
        let content = fs::read_to_string(&normalized)
            .map_err(|error| format!("Failed to read vault file '{}': {}", normalized.display(), error))?;
        let relative_path = normalized
            .strip_prefix(&vault)
            .unwrap_or(normalized.as_path())
            .to_string_lossy()
            .to_string();
        let name = normalized
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&relative_path)
            .to_string();

        let mut absolute_line_start = 0usize;
        for (line_index, line) in content.lines().enumerate() {
            if results.len() >= max_results {
                break;
            }

            let lower_line = line.to_lowercase();
            let mut search_from_byte = 0usize;
            while results.len() < max_results {
                let Some(found_byte) = lower_line[search_from_byte..].find(&normalized_query) else {
                    break;
                };
                let line_match_start_byte = search_from_byte + found_byte;
                let line_match_end_byte = line_match_start_byte + normalized_query.len();
                let line_match_start = line[..line_match_start_byte].chars().count();
                let line_match_end = line[..line_match_end_byte].chars().count();
                let match_start = absolute_line_start + line_match_start;
                let match_end = absolute_line_start + line_match_end;

                results.push(VaultSearchMatch {
                    path: normalized.to_string_lossy().to_string(),
                    relative_path: relative_path.clone(),
                    name: name.clone(),
                    line_number: line_index + 1,
                    line_text: line.to_string(),
                    line_match_start,
                    line_match_end,
                    match_start,
                    match_end,
                });
                search_from_byte = line_match_end_byte;
            }

            absolute_line_start += line.chars().count() + 1;
        }
    }

    Ok(results)
}

fn collect_markdown_files(current: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(current)
        .map_err(|error| format!("Failed to list vault folder '{}': {}", current.display(), error))?
    {
        let entry = entry.map_err(|error| format!("Failed to read vault entry: {}", error))?;
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Failed to read metadata for '{}': {}", path.display(), error))?;
        if metadata.is_dir() {
            collect_markdown_files(&path, files)?;
        } else if metadata.is_file()
            && path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("markdown"))
                .unwrap_or(false)
        {
            files.push(path);
        }
    }

    Ok(())
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
            create_named_vault_note,
            get_file_properties,
            list_vault_files,
            rename_vault_file,
            delete_vault_file,
            duplicate_vault_file,
            get_vault_backlinks,
            search_vault_text,
            open_file_in_new_instance,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_vault() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("hotaru-test-vault-{suffix}"));
        fs::create_dir_all(&path).expect("test vault should be created");
        path
    }

    #[test]
    fn resolve_vault_child_rejects_parent_traversal() {
        let vault = unique_temp_vault();

        let result = resolve_vault_child(&vault, "../outside.md");

        assert!(result.is_err());
        let _ = fs::remove_dir_all(vault);
    }

    #[test]
    fn resolve_existing_vault_file_rejects_paths_outside_vault() {
        let vault = unique_temp_vault();
        let outside = std::env::temp_dir().join("hotaru-outside-file.md");
        fs::write(&outside, "outside").expect("outside file should be written");

        let result = resolve_existing_vault_file(&vault, outside.to_string_lossy().as_ref());

        assert!(result.is_err());
        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(vault);
    }

    #[test]
    fn ensure_hotaru_vault_uses_selected_folder_without_nested_vault() {
        let selected = unique_temp_vault();

        let prepared = ensure_hotaru_vault(selected.to_string_lossy().to_string())
            .expect("selected folder should be prepared as vault");

        assert_eq!(
            PathBuf::from(prepared),
            normalize_path(selected.clone()).expect("selected path should normalize")
        );
        assert!(!selected.join(VAULT_DIR_NAME).exists());
        let _ = fs::remove_dir_all(selected);
    }

    #[test]
    fn vault_file_marks_timestamp_notes_as_drafts() {
        assert!(is_draft_vault_file("hotaru-note-1710000000.md"));
        assert!(is_draft_vault_file("nested/hotaru-note-1710000000-2.md"));
        assert!(!is_draft_vault_file("project-plan.md"));
    }

    #[test]
    fn wiki_link_scanner_extracts_unique_note_names() {
        let links = extract_wiki_links("See [[Project Plan]] and [[daily]] then [[Project Plan]].");

        assert_eq!(links, vec!["Project Plan".to_string(), "daily".to_string()]);
    }

    #[test]
    fn tag_scanner_extracts_inline_and_frontmatter_tags() {
        let tags = extract_tags(
            r#"---
tags:
  - inbox/to-read
  - "Project-A"
---
# Heading is not a tag
Body #meeting #inbox/processing #1984 #meeting.
```
#ignored
```
"#,
        );

        assert_eq!(
            tags,
            vec![
                "inbox/processing".to_string(),
                "inbox/to-read".to_string(),
                "meeting".to_string(),
                "Project-A".to_string(),
            ]
        );
    }

    #[test]
    fn backlink_scan_finds_notes_linking_to_current_stem() {
        let vault = unique_temp_vault();
        fs::write(vault.join("Project.md"), "# Project").expect("current file should be written");
        fs::write(vault.join("Daily.md"), "Link to [[Project]].").expect("daily file should be written");
        fs::write(vault.join("Other.txt"), "[[Project]]").expect("non-md file should be written");

        let backlinks = scan_vault_backlinks(&vault, &vault.join("Project.md"))
            .expect("backlink scan should succeed");

        assert_eq!(backlinks.len(), 1);
        assert_eq!(backlinks[0].relative_path, "Daily.md");
        let _ = fs::remove_dir_all(vault);
    }

    #[test]
    fn vault_text_search_finds_markdown_matches_with_line_snippets() {
        let vault = unique_temp_vault();
        fs::create_dir_all(vault.join("nested")).expect("nested vault folder should be created");
        fs::write(vault.join("Project.md"), "# Project\nAlpha target line\nNo match")
            .expect("project note should be written");
        fs::write(vault.join("nested").join("Daily.md"), "another TARGET mention\n")
            .expect("daily note should be written");
        fs::write(vault.join("ignored.txt"), "target outside markdown")
            .expect("text file should be written");

        let matches = scan_vault_text(&vault, "target", 20).expect("vault search should succeed");

        assert_eq!(matches.len(), 2);
        let project_match = matches
            .iter()
            .find(|result| result.relative_path == "Project.md")
            .expect("project result should be present");
        assert_eq!(project_match.line_number, 2);
        assert_eq!(project_match.line_text, "Alpha target line");
        assert_eq!(project_match.line_match_start, 6);
        assert_eq!(project_match.line_match_end, 12);
        assert_eq!(project_match.match_start, 16);
        assert_eq!(project_match.match_end, 22);
        let daily_match = matches
            .iter()
            .find(|result| result.relative_path == "nested\\Daily.md")
            .expect("nested result should be present");
        assert_eq!(daily_match.line_number, 1);
        let _ = fs::remove_dir_all(vault);
    }

    #[test]
    fn vault_text_search_rejects_empty_queries() {
        let vault = unique_temp_vault();

        let result = scan_vault_text(&vault, "  ", 20);

        assert!(result.is_err());
        let _ = fs::remove_dir_all(vault);
    }
}
