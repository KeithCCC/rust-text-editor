# Koharu Store Phase 1: Identity and Document Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Koharu's product identity consistent and ensure that New, Open, navigation, and Exit cannot lose or corrupt an unsaved document.

**Architecture:** Keep React responsible for user decisions and Rust responsible for durable persistence. A pure `runDocumentTransition` function coordinates Save / Don't Save / Cancel for every destructive action, while one React dialog collects the decision. Rust uses atomic replacement for normal saves and stores one crash-recovery draft in the platform app-data directory.

**Tech Stack:** React 18, TypeScript 5.6, Vitest 4, Tauri 2.9, Rust 2024, `atomicwrites` 0.4.4, `serde_json` 1.x.

## Global Constraints

- Public product name: `Koharu`.
- Publisher brand: `Daily AI Lab`; Authenticode legal signer configuration remains a later distribution-phase prerequisite.
- Development version remains `0.1.3`; this phase does not change the app to `1.0.0`.
- Windows x64 remains the first Store target.
- Preserve the current single-document editor model.
- Preserve Hotaru only as the explicitly documented experimental sibling; remove Hotaru from packaged-app identity.
- No telemetry, network service, updater, file-association, or Store-packaging work belongs in this phase.
- Recovery data stays local in Koharu's Tauri app-data directory.
- Every production change follows red-green-refactor and receives an independently reviewable commit.

---

## File structure

### New frontend units

- `src/documentLifecycle.ts` — pure Save / Don't Save / Cancel transition coordinator.
- `src/documentLifecycle.test.ts` — exhaustive transition-decision tests.
- `src/documentSafetyText.ts` — English and Japanese safety-dialog copy.
- `src/documentSafetyText.test.ts` — exact copy and filename interpolation tests.
- `src/components/DecisionDialog.tsx` — reusable decision dialog foundation.
- `src/components/DecisionDialog.test.tsx` — semantic rendering tests.
- `src/recoveryDraftQueue.ts` — serializes recovery writes and clears to prevent stale-write races.
- `src/recoveryDraftQueue.test.ts` — operation-order and failure-recovery tests.

### New Rust units

- `src-tauri/src/atomic_write.rs` — cross-platform atomic file replacement wrapper.
- `src-tauri/src/recovery.rs` — recovery-draft model, app-data persistence, stale-draft filtering, and Tauri commands.

### Modified units

- `src/App.tsx` — integrates the lifecycle coordinator, one close listener, decision dialogs, recovery scheduling, and startup recovery.
- `src/tauri.ts` — typed recovery commands.
- `src/fileDocument.ts` and `src/fileDocument.test.ts` — canonical `Koharu` display name.
- `src/components/ExcalidrawEditor.tsx` — continues calling the existing command, which becomes atomic in Rust.
- `src/styles.css` — decision-dialog layout and button emphasis.
- `src-tauri/src/lib.rs` — routes all text and Excalidraw writes through atomic persistence and registers recovery commands.
- `src-tauri/Cargo.toml` — adds direct atomic-write and JSON dependencies.
- `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `index.html` — packaged identity.
- `README.md` — makes the Store-target identity explicit without removing Hotaru history.

### Removed units

- `src/windowCloseBehavior.ts` — superseded by the lifecycle coordinator.
- `src/windowCloseBehavior.test.ts` — superseded by exhaustive transition tests.

---

### Task 1: Normalize Koharu product identity

**Files:**
- Modify: `src/fileDocument.test.ts`
- Modify: `src/fileDocument.ts`
- Modify: `index.html`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `README.md`

**Interfaces:**
- Produces: `APP_DISPLAY_NAME = "Koharu"`, used by all document-window titles.
- Produces: stable Tauri identifier `lab.dailyai.koharu`.

- [ ] **Step 1: Change the title expectations first**

```ts
test("formats titles with the canonical Koharu product name", () => {
  expect(formatDocumentTitle(null, false)).toBe("Untitled - Koharu");
  expect(formatDocumentTitle("C:\\notes\\todo.md", false)).toBe("todo.md - Koharu");
  expect(formatDocumentTitle("C:\\notes\\todo.md", true)).toBe("*todo.md - Koharu");
});
```

- [ ] **Step 2: Run the focused test and verify the old name fails**

Run: `npm test -- src/fileDocument.test.ts`

Expected: FAIL because the implementation still emits `Koharu markdown editor`.

- [ ] **Step 3: Update the canonical frontend name**

```ts
export const APP_DISPLAY_NAME = "Koharu";
```

- [ ] **Step 4: Align packaged metadata**

Apply these exact values:

```html
<title>Koharu</title>
```

```json
{
  "productName": "Koharu",
  "version": "0.1.3",
  "identifier": "lab.dailyai.koharu"
}
```

Set the Tauri window title to `Koharu`. In `src-tauri/Cargo.toml`, keep `name = "koharu"`, change `authors` to `["Daily AI Lab"]`, and keep the current description and version.

Add this sentence after the first README paragraph:

```markdown
Koharu is the application being prepared for Microsoft Store publication under the Daily AI Lab brand.
```

- [ ] **Step 5: Verify identity and tests**

Run: `npm test -- src/fileDocument.test.ts`

Expected: PASS.

Run: `rg -n 'Koharu markdown editor|com\.local\.koharu|<title>Hotaru</title>' index.html src src-tauri -g '!src-tauri/gen/**'`

Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add index.html README.md src/fileDocument.ts src/fileDocument.test.ts src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: normalize Koharu product identity"
```

---

### Task 2: Add atomic persistence for documents and Excalidraw

**Files:**
- Create: `src-tauri/src/atomic_write.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `atomic_write::write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String>`.
- Consumed by: `write_text_file`, `write_excalidraw_file`, and Task 3 recovery persistence.

- [ ] **Step 1: Add the dependencies and failing Rust tests**

Add:

```toml
[dependencies]
atomicwrites = "0.4.4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tauri = { version = "2.9.3", features = [] }
tauri-plugin-dialog = "2.4.1"

[dev-dependencies]
tempfile = "3"
```

Create `src-tauri/src/atomic_write.rs` with tests first:

```rust
use std::path::Path;

pub fn write_atomic(_path: &Path, _bytes: &[u8]) -> Result<(), String> {
    Err("atomic write is not implemented".to_string())
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
```

- [ ] **Step 2: Run the Rust tests and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml atomic_write`

Expected: FAIL in `creates_and_replaces_a_file` with `atomic write is not implemented`.

- [ ] **Step 3: Implement the atomic writer**

Replace the stub with:

```rust
use atomicwrites::{AllowOverwrite, AtomicFile};
use std::io::Write;
use std::path::Path;

pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            format!("Failed to prepare directory '{}': {error}", parent.display())
        })?;
    }

    AtomicFile::new(path, AllowOverwrite)
        .write(|file| {
            file.write_all(bytes)?;
            file.sync_all()
        })
        .map_err(|error| format!("Failed to atomically write '{}': {error}", path.display()))
}
```

- [ ] **Step 4: Route both existing save commands through it**

At the top of `src-tauri/src/lib.rs`:

```rust
mod atomic_write;
```

Replace both write bodies:

```rust
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    atomic_write::write_atomic(Path::new(&path), content.as_bytes())
}

#[tauri::command]
fn write_excalidraw_file(path: String, content: String) -> Result<(), String> {
    atomic_write::write_atomic(Path::new(&path), content.as_bytes())
}
```

- [ ] **Step 5: Verify atomic persistence**

Run: `cargo test --manifest-path src-tauri/Cargo.toml atomic_write`

Expected: 2 tests PASS.

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: success with no compile errors.

- [ ] **Step 6: Commit**

```bash
git add Cargo.lock src-tauri/Cargo.toml src-tauri/src/atomic_write.rs src-tauri/src/lib.rs
git commit -m "feat: save documents with atomic replacement"
```

---

### Task 3: Persist and validate one recovery draft in app data

**Files:**
- Create: `src-tauri/src/recovery.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces Rust/JSON shape: `RecoveryDraft { schemaVersion: 1, documentPath: string | null, content: string, updatedMs: number }`.
- Produces Tauri commands: `read_recovery_draft`, `write_recovery_draft`, `delete_recovery_draft`.
- Consumes: `atomic_write::write_atomic` from Task 2.

- [ ] **Step 1: Write recovery persistence tests around directory-level helpers**

Create the model and tests in `src-tauri/src/recovery.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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

pub fn write_at(_base: &Path, _draft: &RecoveryDraft) -> Result<(), String> {
    Err("recovery write is not implemented".to_string())
}

pub fn read_at(_base: &Path) -> Result<Option<RecoveryDraft>, String> {
    Ok(None)
}

pub fn delete_at(_base: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{delete_at, draft_path, read_at, write_at, RecoveryDraft};
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
```

- [ ] **Step 2: Run and observe the missing implementation**

Run: `cargo test --manifest-path src-tauri/Cargo.toml recovery`

Expected: FAIL in the round-trip test with `recovery write is not implemented`.

- [ ] **Step 3: Implement the directory-level operations**

```rust
use crate::atomic_write::write_atomic;
use std::fs;

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
            return Err(format!("Failed to parse recovery draft; the invalid draft was removed: {error}"));
        }
    };

    if draft.schema_version != 1 {
        let schema = draft.schema_version;
        let _ = delete_at(base);
        return Err(format!("Unsupported recovery draft schema {schema}; the draft was removed"));
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
```

- [ ] **Step 4: Add the Tauri command boundary**

```rust
use tauri::{AppHandle, Manager};

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
```

Register the module and commands in `src-tauri/src/lib.rs`:

```rust
mod recovery;
```

```rust
recovery::read_recovery_draft,
recovery::write_recovery_draft,
recovery::delete_recovery_draft,
```

- [ ] **Step 5: Verify recovery persistence**

Run: `cargo test --manifest-path src-tauri/Cargo.toml recovery`

Expected: 4 tests PASS.

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/recovery.rs src-tauri/src/lib.rs
git commit -m "feat: persist crash recovery drafts"
```

---

### Task 4: Define the document transition state machine

**Files:**
- Create: `src/documentLifecycle.ts`
- Create: `src/documentLifecycle.test.ts`

**Interfaces:**
- Produces: `UnsavedDecision = "save" | "discard" | "cancel"`.
- Produces: `runDocumentTransition(options: DocumentTransitionOptions) -> Promise<boolean>`.
- Consumed by: all destructive actions integrated in Task 7.

- [ ] **Step 1: Write exhaustive behavior tests**

```ts
import { describe, expect, test, vi } from "vitest";
import { runDocumentTransition, type UnsavedDecision } from "./documentLifecycle";

function setup(modified: boolean) {
  return {
    modified,
    requestDecision: vi.fn<() => Promise<UnsavedDecision>>(async () => "cancel"),
    save: vi.fn(async () => true),
    discardRecovery: vi.fn(async () => undefined),
    proceed: vi.fn(async () => undefined),
  };
}

describe("runDocumentTransition", () => {
  test("proceeds without prompting for a clean document", async () => {
    const options = setup(false);
    expect(await runDocumentTransition(options)).toBe(true);
    expect(options.requestDecision).not.toHaveBeenCalled();
    expect(options.proceed).toHaveBeenCalledTimes(1);
  });

  test("saves before proceeding", async () => {
    const options = setup(true);
    options.requestDecision.mockResolvedValue("save");
    expect(await runDocumentTransition(options)).toBe(true);
    expect(options.save).toHaveBeenCalledTimes(1);
    expect(options.proceed).toHaveBeenCalledTimes(1);
  });

  test("stops when Save As is canceled or saving fails", async () => {
    const options = setup(true);
    options.requestDecision.mockResolvedValue("save");
    options.save.mockResolvedValue(false);
    expect(await runDocumentTransition(options)).toBe(false);
    expect(options.proceed).not.toHaveBeenCalled();
  });

  test("clears recovery before discarding and proceeding", async () => {
    const order: string[] = [];
    const options = setup(true);
    options.requestDecision.mockResolvedValue("discard");
    options.discardRecovery.mockImplementation(async () => { order.push("discard"); });
    options.proceed.mockImplementation(async () => { order.push("proceed"); });
    expect(await runDocumentTransition(options)).toBe(true);
    expect(order).toEqual(["discard", "proceed"]);
  });

  test("Cancel preserves the document", async () => {
    const options = setup(true);
    expect(await runDocumentTransition(options)).toBe(false);
    expect(options.save).not.toHaveBeenCalled();
    expect(options.discardRecovery).not.toHaveBeenCalled();
    expect(options.proceed).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused test and verify the module is missing**

Run: `npm test -- src/documentLifecycle.test.ts`

Expected: FAIL because `documentLifecycle.ts` does not exist.

- [ ] **Step 3: Implement the state machine**

```ts
export type UnsavedDecision = "save" | "discard" | "cancel";

export type DocumentTransitionOptions = {
  modified: boolean;
  requestDecision: () => Promise<UnsavedDecision>;
  save: () => Promise<boolean>;
  discardRecovery: () => Promise<void>;
  proceed: () => Promise<void>;
};

export async function runDocumentTransition({
  modified,
  requestDecision,
  save,
  discardRecovery,
  proceed,
}: DocumentTransitionOptions) {
  if (modified) {
    const decision = await requestDecision();
    if (decision === "cancel") {
      return false;
    }
    if (decision === "save" && !(await save())) {
      return false;
    }
    if (decision === "discard") {
      await discardRecovery();
    }
  }

  await proceed();
  return true;
}
```

- [ ] **Step 4: Verify the state machine**

Run: `npm test -- src/documentLifecycle.test.ts`

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/documentLifecycle.ts src/documentLifecycle.test.ts
git commit -m "feat: coordinate destructive document actions"
```

---

### Task 5: Add the reusable decision dialog and localized safety copy

**Files:**
- Create: `src/components/DecisionDialog.tsx`
- Create: `src/components/DecisionDialog.test.tsx`
- Create: `src/documentSafetyText.ts`
- Create: `src/documentSafetyText.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `DecisionDialog({ title, message, actions, cancelId, onDecision })`.
- Produces: `getDocumentSafetyText(language, fileName)`.
- Consumed by: Task 7 unsaved and recovery prompts.

- [ ] **Step 1: Write semantic dialog tests**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DecisionDialog } from "./DecisionDialog";

test("renders a named modal and explicit decisions", () => {
  const html = renderToStaticMarkup(
    <DecisionDialog
      title="Save changes?"
      message="notes.md has unsaved changes."
      actions={[
        { id: "save", label: "Save", emphasis: "primary" },
        { id: "discard", label: "Don't Save", emphasis: "danger" },
        { id: "cancel", label: "Cancel" },
      ]}
      cancelId="cancel"
      onDecision={() => undefined}
    />,
  );

  expect(html).toContain('role="dialog"');
  expect(html).toContain('aria-modal="true"');
  expect(html).toContain("Save changes?");
  expect(html).toContain("Don&#x27;t Save");
});
```

- [ ] **Step 2: Write exact localization tests**

```ts
import { describe, expect, test } from "vitest";
import { getDocumentSafetyText } from "./documentSafetyText";

describe("document safety copy", () => {
  test("names the English document", () => {
    expect(getDocumentSafetyText("en", "notes.md").unsavedMessage)
      .toBe("notes.md has unsaved changes.");
  });

  test("provides Japanese recovery copy", () => {
    const text = getDocumentSafetyText("ja", "メモ.md");
    expect(text.unsavedTitle).toBe("変更を保存しますか？");
    expect(text.recoveryTitle).toBe("未保存の文書を復元しますか？");
  });
});
```

- [ ] **Step 3: Run the tests and verify both modules are missing**

Run: `npm test -- src/components/DecisionDialog.test.tsx src/documentSafetyText.test.ts`

Expected: FAIL because both production modules are absent.

- [ ] **Step 4: Implement the localized copy**

```ts
export type DocumentSafetyLanguage = "en" | "ja";

export function getDocumentSafetyText(language: DocumentSafetyLanguage, fileName: string) {
  if (language === "ja") {
    return {
      unsavedTitle: "変更を保存しますか？",
      unsavedMessage: `${fileName} には保存されていない変更があります。`,
      save: "保存",
      dontSave: "保存しない",
      cancel: "キャンセル",
      recoveryTitle: "未保存の文書を復元しますか？",
      recoveryMessage: "前回のセッションで保存されなかった変更が見つかりました。",
      recover: "復元",
      discardRecovery: "破棄",
      recoveryFailed: "復元データの処理に失敗しました",
    } as const;
  }

  return {
    unsavedTitle: "Save changes?",
    unsavedMessage: `${fileName} has unsaved changes.`,
    save: "Save",
    dontSave: "Don't Save",
    cancel: "Cancel",
    recoveryTitle: "Recover unsaved document?",
    recoveryMessage: "Koharu found changes that were not saved in the previous session.",
    recover: "Recover",
    discardRecovery: "Discard",
    recoveryFailed: "Recovery data could not be processed",
  } as const;
}
```

- [ ] **Step 5: Implement the dialog foundation**

```tsx
import { useEffect, useId, useRef } from "react";

type DecisionAction = {
  id: string;
  label: string;
  emphasis?: "primary" | "danger";
};

type DecisionDialogProps = {
  title: string;
  message: string;
  actions: readonly DecisionAction[];
  cancelId: string;
  onDecision: (id: string) => void;
};

export function DecisionDialog({
  title,
  message,
  actions,
  cancelId,
  onDecision,
}: DecisionDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDecision(cancelId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelId, onDecision]);

  return (
    <div className="modal-backdrop">
      <section
        className="decision-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <div className="decision-dialog-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              ref={action.id === cancelId ? cancelRef : undefined}
              type="button"
              className={action.emphasis ? `decision-${action.emphasis}` : undefined}
              onClick={() => onDecision(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

Add styles using existing tokens:

```css
.decision-dialog {
  width: min(520px, 100%);
  padding: 20px;
  border: 1px solid var(--strong-border);
  border-radius: 10px;
  background: var(--pane-bg);
  box-shadow: 0 22px 60px var(--shadow);
}

.decision-dialog h2 {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 18px;
}

.decision-dialog p {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.decision-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.decision-primary {
  border-color: var(--preview-link);
  background: var(--preview-link);
  color: var(--pane-bg);
}

.decision-danger {
  border-color: var(--danger-border);
  color: var(--danger-text);
}
```

- [ ] **Step 6: Verify the dialog and copy**

Run: `npm test -- src/components/DecisionDialog.test.tsx src/documentSafetyText.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/DecisionDialog.tsx src/components/DecisionDialog.test.tsx src/documentSafetyText.ts src/documentSafetyText.test.ts src/styles.css
git commit -m "feat: add document safety decision dialogs"
```

---

### Task 6: Serialize frontend recovery operations

**Files:**
- Modify: `src/tauri.ts`
- Create: `src/recoveryDraftQueue.ts`
- Create: `src/recoveryDraftQueue.test.ts`

**Interfaces:**
- Produces frontend `RecoveryDraft` matching the Rust JSON model.
- Produces `readRecoveryDraft()`, `writeRecoveryDraft(draft)`, and `deleteRecoveryDraft()`.
- Produces `RecoveryDraftQueue.write`, `.clear`, and `.drain`.

- [ ] **Step 1: Write queue ordering and failure tests**

```ts
import { describe, expect, test, vi } from "vitest";
import { RecoveryDraftQueue, type RecoveryDraft } from "./recoveryDraftQueue";

const draft: RecoveryDraft = {
  schemaVersion: 1,
  documentPath: null,
  content: "draft",
  updatedMs: 42,
};

describe("RecoveryDraftQueue", () => {
  test("clears only after an earlier write completes", async () => {
    const order: string[] = [];
    const queue = new RecoveryDraftQueue(
      async () => { order.push("write"); },
      async () => { order.push("clear"); },
    );
    await Promise.all([queue.write(draft), queue.clear()]);
    expect(order).toEqual(["write", "clear"]);
  });

  test("a failed write does not prevent a later clear", async () => {
    const clear = vi.fn(async () => undefined);
    const queue = new RecoveryDraftQueue(
      async () => { throw new Error("disk full"); },
      clear,
    );
    await expect(queue.write(draft)).rejects.toThrow("disk full");
    await queue.clear();
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/recoveryDraftQueue.test.ts`

Expected: FAIL because the queue module does not exist.

- [ ] **Step 3: Add typed Tauri recovery calls**

```ts
export type RecoveryDraft = {
  schemaVersion: 1;
  documentPath: string | null;
  content: string;
  updatedMs: number;
};

export function readRecoveryDraft() {
  return invoke<RecoveryDraft | null>("read_recovery_draft");
}

export function writeRecoveryDraft(draft: RecoveryDraft) {
  return invoke<void>("write_recovery_draft", { draft });
}

export function deleteRecoveryDraft() {
  return invoke<void>("delete_recovery_draft");
}
```

- [ ] **Step 4: Implement the queue**

```ts
import type { RecoveryDraft } from "./tauri";
export type { RecoveryDraft } from "./tauri";

type WriteDraft = (draft: RecoveryDraft) => Promise<void>;
type ClearDraft = () => Promise<void>;

export class RecoveryDraftQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writeDraft: WriteDraft,
    private readonly clearDraft: ClearDraft,
  ) {}

  private enqueue(operation: () => Promise<void>) {
    const result = this.tail.catch(() => undefined).then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }

  write(draft: RecoveryDraft) {
    return this.enqueue(() => this.writeDraft(draft));
  }

  clear() {
    return this.enqueue(this.clearDraft);
  }

  drain() {
    return this.tail;
  }
}
```

- [ ] **Step 5: Verify ordering**

Run: `npm test -- src/recoveryDraftQueue.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tauri.ts src/recoveryDraftQueue.ts src/recoveryDraftQueue.test.ts
git commit -m "feat: serialize recovery draft operations"
```

---

### Task 7: Integrate one lifecycle and recovery flow into App

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/windowCloseBehavior.ts`
- Delete: `src/windowCloseBehavior.test.ts`

**Interfaces:**
- Consumes: `runDocumentTransition`, `DecisionDialog`, `getDocumentSafetyText`, `RecoveryDraftQueue`, and recovery Tauri commands.
- Produces: one `onCloseRequested` registration and one decision path for every destructive action.

- [ ] **Step 1: Replace obsolete imports and add safety dependencies**

Use these imports:

```ts
import { DecisionDialog } from "./components/DecisionDialog";
import { runDocumentTransition, type UnsavedDecision } from "./documentLifecycle";
import { getDocumentSafetyText } from "./documentSafetyText";
import { RecoveryDraftQueue, type RecoveryDraft } from "./recoveryDraftQueue";
import {
  deleteRecoveryDraft,
  exitApp,
  getFileProperties,
  getStartupFilePath,
  readExcalidrawFile,
  readRecoveryDraft,
  readTextFile,
  resolveRelativePath,
  writeRecoveryDraft,
  writeTextFile,
} from "./tauri";
```

Remove imports from `windowCloseBehavior`.

- [ ] **Step 2: Add prompt, recovery, and concurrency state**

Inside `App`:

```ts
const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState(false);
const [startupRecoveryDraft, setStartupRecoveryDraft] = useState<RecoveryDraft | null>(null);
const [pendingStartupPath, setPendingStartupPath] = useState<string | null>(null);
const [resumeStartupPathAfterRecovery, setResumeStartupPathAfterRecovery] = useState(false);
const unsavedPromptRef = useRef<{
  promise: Promise<UnsavedDecision>;
  resolve: (decision: UnsavedDecision) => void;
} | null>(null);
const transitionInProgressRef = useRef(false);
const lastRecoveryWriteMsRef = useRef(0);
const startupLoadedRef = useRef(false);
const recoveryQueueRef = useRef(
  new RecoveryDraftQueue(writeRecoveryDraft, deleteRecoveryDraft),
);
const safetyText = getDocumentSafetyText(appLanguage, fileNameFromPath(currentFile));
```

- [ ] **Step 3: Implement one deferred decision and safe draft clearing**

```ts
const requestUnsavedDecision = useCallback(() => {
  if (unsavedPromptRef.current) {
    return unsavedPromptRef.current.promise;
  }

  let resolve!: (decision: UnsavedDecision) => void;
  const promise = new Promise<UnsavedDecision>((next) => { resolve = next; });
  unsavedPromptRef.current = { promise, resolve };
  setIsUnsavedPromptOpen(true);
  return promise;
}, []);

const resolveUnsavedDecision = useCallback((decision: UnsavedDecision) => {
  const prompt = unsavedPromptRef.current;
  if (!prompt) return;
  unsavedPromptRef.current = null;
  setIsUnsavedPromptOpen(false);
  prompt.resolve(decision);
}, []);

const clearRecoverySafely = useCallback(async () => {
  try {
    await recoveryQueueRef.current.clear();
  } catch (recoveryError) {
    showError(
      safetyText.recoveryFailed,
      recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
    );
  }
}, [safetyText.recoveryFailed, showError]);
```

- [ ] **Step 4: Clear recovery after successful normal saves**

In both `handleSaveAs` and `handleSave`, after `writeTextFile` succeeds and before returning `true`:

```ts
await clearRecoverySafely();
setModified(false);
```

Keep a canceled Save As or failed write returning `false` so the transition stops.

- [ ] **Step 5: Define the single transition wrapper**

Delete the current `confirmDiscardChanges`, `requestAppClose`, `handleNew`, `handleOpen`, and `handleExit` declarations. Place the transition callback below `handleSave`, then recreate New, Open, Exit, and `requestAppClose` below it. This ordering prevents React dependency arrays from reading a callback before initialization.

Add:

```ts
const requestDocumentTransition = useCallback(async (proceed: () => Promise<void>) => {
  if (transitionInProgressRef.current) return false;
  transitionInProgressRef.current = true;
  try {
    return await runDocumentTransition({
      modified,
      requestDecision: requestUnsavedDecision,
      save: handleSave,
      discardRecovery: clearRecoverySafely,
      proceed,
    });
  } finally {
    transitionInProgressRef.current = false;
  }
}, [clearRecoverySafely, handleSave, modified, requestUnsavedDecision]);
```

- [ ] **Step 6: Route New, Open, links, drop, Exit, and native close through it**

New:

```ts
const handleNew = useCallback(async () => {
  await requestDocumentTransition(async () => {
    resetDocument();
    requestAnimationFrame(() => editorRef.current?.focus());
  });
}, [requestDocumentTransition, resetDocument]);
```

Open must show the picker before asking to discard:

```ts
if (selected) {
  await requestDocumentTransition(() => openFilePath(selected));
}
```

Relative Markdown link:

```ts
const path = await resolveRelativePath(currentFile, relativePath);
await requestDocumentTransition(() => openFilePath(path));
```

Drop:

```ts
if (path) {
  void requestDocumentTransition(() => openFilePath(path));
}
```

Exit and the only native listener:

```ts
const requestAppClose = useCallback(() => requestDocumentTransition(async () => {
  await saveCurrentWindowState();
  if (isTauriRuntime()) await exitApp();
  else window.close();
}), [requestDocumentTransition]);

useEffect(() => {
  if (!isTauriRuntime()) return undefined;
  let unlisten: (() => void) | undefined;
  let cancelled = false;
  void getCurrentWindow().onCloseRequested((event) => {
    event.preventDefault();
    void requestAppClose();
  }).then((handler) => {
    if (cancelled) handler();
    else unlisten = handler;
  });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}, [requestAppClose]);
```

Delete both old close effects rather than adapting either one.

- [ ] **Step 7: Schedule serialized recovery writes**

Add near the other persistence effects:

```ts
useEffect(() => {
  if (!isTauriRuntime() || !modified) return undefined;
  if (lastRecoveryWriteMsRef.current === 0) {
    lastRecoveryWriteMsRef.current = Date.now();
  }
  const elapsed = Date.now() - lastRecoveryWriteMsRef.current;
  const delay = Math.min(2000, Math.max(0, 30_000 - elapsed));
  const timer = window.setTimeout(() => {
    void recoveryQueueRef.current.write({
      schemaVersion: 1,
      documentPath: currentFile,
      content,
      updatedMs: Date.now(),
    }).then(() => {
      lastRecoveryWriteMsRef.current = Date.now();
    }, (recoveryError) => {
      showError(
        safetyText.recoveryFailed,
        recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
      );
    });
  }, delay);
  return () => window.clearTimeout(timer);
}, [content, currentFile, modified, safetyText.recoveryFailed, showError]);
```

This writes after two seconds of idle time and forces a snapshot by 30 seconds even during continuous typing.

- [ ] **Step 8: Load recovery before processing a startup file**

Replace the current startup-file effect:

```ts
useEffect(() => {
  if (!isTauriRuntime() || startupLoadedRef.current) return;
  startupLoadedRef.current = true;
  const recovery = readRecoveryDraft().catch((recoveryError) => {
    showError(
      safetyText.recoveryFailed,
      recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
    );
    return null;
  });
  void Promise.all([recovery, getStartupFilePath()])
    .then(([draft, startupPath]) => {
      setPendingStartupPath(startupPath);
      if (draft) setStartupRecoveryDraft(draft);
      else if (startupPath) void openFilePath(startupPath);
    })
    .catch((startupError) => {
      showError(
        text.startupOpenFailed,
        startupError instanceof Error ? startupError.message : String(startupError),
      );
    });
}, [openFilePath, safetyText.recoveryFailed, showError, text.startupOpenFailed]);
```

Resolve recovery with these callbacks:

```ts
const finishStartupRecovery = useCallback(async (recover: boolean) => {
  const draft = startupRecoveryDraft;
  if (!draft) return;
  setStartupRecoveryDraft(null);

  if (recover) {
    setContent(draft.content);
    setPreviewContent(draft.content);
    setCurrentFile(draft.documentPath);
    setModified(true);
  } else {
    await clearRecoverySafely();
  }

  if (pendingStartupPath) {
    if (recover) {
      setResumeStartupPathAfterRecovery(true);
    } else {
      const path = pendingStartupPath;
      setPendingStartupPath(null);
      await openFilePath(path);
    }
  }
}, [clearRecoverySafely, openFilePath, pendingStartupPath, startupRecoveryDraft]);
```

Defer activation of the requested startup file until the next render so the transition coordinator sees the recovered content and `modified: true` rather than stale pre-recovery state:

```ts
useEffect(() => {
  if (!resumeStartupPathAfterRecovery || !pendingStartupPath) return;
  const path = pendingStartupPath;
  setResumeStartupPathAfterRecovery(false);
  setPendingStartupPath(null);
  void requestDocumentTransition(() => openFilePath(path));
}, [openFilePath, pendingStartupPath, requestDocumentTransition, resumeStartupPathAfterRecovery]);
```

- [ ] **Step 9: Render both decision dialogs**

Before the Excalidraw modal:

```tsx
{isUnsavedPromptOpen && (
  <DecisionDialog
    title={safetyText.unsavedTitle}
    message={safetyText.unsavedMessage}
    actions={[
      { id: "save", label: safetyText.save, emphasis: "primary" },
      { id: "discard", label: safetyText.dontSave, emphasis: "danger" },
      { id: "cancel", label: safetyText.cancel },
    ]}
    cancelId="cancel"
    onDecision={(id) => resolveUnsavedDecision(id as UnsavedDecision)}
  />
)}

{startupRecoveryDraft && (
  <DecisionDialog
    title={safetyText.recoveryTitle}
    message={safetyText.recoveryMessage}
    actions={[
      { id: "recover", label: safetyText.recover, emphasis: "primary" },
      { id: "discard", label: safetyText.discardRecovery, emphasis: "danger" },
    ]}
    cancelId="recover"
    onDecision={(id) => void finishStartupRecovery(id === "recover")}
  />
)}
```

Recovery uses Recover as the Escape-safe choice so dismissing the dialog cannot destroy the draft.

- [ ] **Step 10: Remove obsolete close helpers and verify one listener**

Delete:

```text
src/windowCloseBehavior.ts
src/windowCloseBehavior.test.ts
```

Run: `rg -n "onCloseRequested" src/App.tsx`

Expected: exactly one match.

Run: `rg -n "window\.confirm|confirmDiscardChanges|canCloseWindow|handleCloseRequested" src`

Expected: no matches.

- [ ] **Step 11: Run frontend verification**

Run: `npm test`

Expected: all test files PASS.

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 12: Commit**

```bash
git add -A src/App.tsx src/windowCloseBehavior.ts src/windowCloseBehavior.test.ts
git commit -m "feat: protect unsaved documents across app transitions"
```

---

### Task 8: Run the Phase 1 release-safety verification gate

**Files:**
- Create: `docs/work-log/2026-07-18.md`

**Interfaces:**
- Validates all Phase 1 deliverables together.
- Produces a durable verification record for the next phase plan.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: every frontend test file PASS.

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: every Rust test PASS, including 2 atomic-write and 4 recovery tests.

- [ ] **Step 2: Run both production build checks**

Run: `npm run build`

Expected: TypeScript and Vite succeed.

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: Rust compilation succeeds.

- [ ] **Step 3: Run the desktop smoke matrix**

Run: `npm run tauri dev`

Verify all cases manually:

1. Clean untitled document closes without a prompt.
2. Modified untitled document shows one Save / Don't Save / Cancel dialog.
3. Cancel leaves the window and document open.
4. Save opens Save As; canceling Save As leaves the window open.
5. Save succeeds, clears the dirty marker, and closes only after persistence.
6. Don't Save closes without writing the current edits.
7. New, Open, relative-link navigation, and single-file drop use the same three decisions.
8. Force-stop after editing, restart, choose Recover, and observe the restored modified content.
9. Restart with a saved file whose content matches the draft and observe no recovery prompt.
10. Save both Markdown and Excalidraw content and verify the destination files remain readable.

- [ ] **Step 4: Record the successful gate**

Create `docs/work-log/2026-07-18.md` with this exact structure after every check passes:

```markdown
# 2026-07-18

## Koharu Store Phase 1 verification

- Frontend tests passed.
- Rust tests passed, including atomic-write and recovery coverage.
- Frontend production build passed.
- Rust compile check passed.
- Desktop smoke matrix passed for one-prompt close behavior, Save / Don't Save / Cancel, atomic Markdown and Excalidraw saves, and crash recovery.

Phase 1 is ready for the Core Usability and Accessibility plan.
```

- [ ] **Step 5: Commit the verification record**

```bash
git add docs/work-log/2026-07-18.md
git commit -m "docs: verify Koharu document safety phase"
```

---

## Subsequent phase plans

After this plan passes its release-safety gate, create and approve separate implementation plans in this order:

1. Core usability and accessibility: welcome screen, recent files, Edit menu, full menu keyboard model, shared modal migration, focus, Narrator, scaling, touch targets, and language detection.
2. Trust and platform integration: About, local-data controls, protected preview, app-data logs, file associations, update checks, and safe window restoration.
3. Distribution readiness: x64 MSI lifecycle, Certum personal code signing, immutable hosting, privacy/support destinations, and dandelion Store assets.
4. Release validation: signed 0.9.0 persona review, accessibility matrix, clean-machine certification rehearsal, and 1.0.0 promotion.
