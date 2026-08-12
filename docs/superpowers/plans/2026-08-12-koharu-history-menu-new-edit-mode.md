# Koharu History Menu and New-Document Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move recent files into a compact top-level History menu and switch every successfully created blank document to Edit mode without changing the saved startup-mode preference.

**Architecture:** Keep `App.tsx` as the owner of menu state, recent-file state, and document transitions, following its existing top-level popover pattern. Add focused integration coverage for History-menu markup and behavior, then extend the existing document-session safety suite for the New transition. Use a one-shot persistence-suppression ref so the New command can change the active view to Edit while the existing explicit view controls continue to persist user choices.

**Tech Stack:** React 18, TypeScript, Vitest with jsdom, CSS, Vite

## Global Constraints

- History is a localized top-level menu immediately after File.
- Recent-file ordering, ten-entry limit, persistence, missing-file cleanup, and full-path file opening remain unchanged.
- Each visible filename is one line, uses an ellipsis when needed, and exposes the complete filename with `title`.
- The history path subtitle is removed; the stored full path remains the value used to open the file.
- New changes to Edit only after the safe document transition succeeds; cancellation preserves the document and mode.
- The New-induced mode change must not overwrite `koharu-editor-mode`; explicit View menu and view-switcher changes retain existing persistence.
- No new dependencies.

---

## File Map

- Create `src/App.historyMenu.test.tsx`: focused DOM integration tests for History structure, localization, empty state, truncation hooks, and recent-file actions.
- Modify `src/App.tsx`: localized copy, `MenuId`, History popover, File-menu cleanup, and successful-New Edit transition.
- Modify `src/styles.css`: bounded History width and single-line filename ellipsis.
- Modify `src/App.documentSessionSafety.test.tsx`: successful and canceled New-mode transition regression coverage.

### Task 1: Dedicated Compact History Menu

**Files:**
- Create: `src/App.historyMenu.test.tsx`
- Modify: `src/App.tsx:103-240`
- Modify: `src/App.tsx:1360-1403`
- Modify: `src/styles.css:318-385`
- Modify: `src/styles.css:527-565`

**Interfaces:**
- Consumes: `recentFiles: RecentFile[]`, `fileNameFromPath(path: string): string`, `removeRecentFile(history, path)`, `requestDocumentTransition`, and `openFilePath` already owned by `App`.
- Produces: `MenuId` member `"history"`; localized `text.history` and `text.noRecentFiles`; `.history-menu-popover`; `.recent-file-name`.

- [ ] **Step 1: Create the focused integration test harness and failing History structure test**

Create `src/App.historyMenu.test.tsx` with the same jsdom setup and Tauri mocks used by `App.documentSessionSafety.test.tsx`. Set recent history before rendering, then assert the new structure:

```tsx
it("moves recent files out of File and into a top-level History menu", async () => {
  window.localStorage.setItem("koharu-recent-files", JSON.stringify([
    { path: "C:\\notes\\a-very-long-history-filename-that-needs-clipping.md", lastAccessedAt: 2 },
    { path: "C:\\notes\\short.md", lastAccessedAt: 1 },
  ]));
  await renderApp();

  await click(button("File"));
  const fileMenu = openMenu();
  expect(fileMenu.textContent).not.toContain("a-very-long-history-filename-that-needs-clipping.md");
  expect(fileMenu.textContent).not.toContain("Clear Recent Files");

  await click(button("History"));
  const historyMenu = openMenu();
  const longName = button("a-very-long-history-filename-that-needs-clipping.md", historyMenu);
  expect(historyMenu.classList.contains("history-menu-popover")).toBe(true);
  expect(longName.title).toBe("a-very-long-history-filename-that-needs-clipping.md");
  expect(longName.querySelector(".recent-file-name")?.textContent).toBe(
    "a-very-long-history-filename-that-needs-clipping.md",
  );
  expect(longName.querySelector("small")).toBeNull();
  expect(historyMenu.textContent).not.toContain("C:\\notes");
  expect(button("Clear Recent Files", historyMenu)).not.toBeNull();
});
```

The harness helpers have these signatures:

```tsx
async function renderApp(): Promise<void>;
async function click(target: HTMLElement): Promise<void>;
function button(label: string, scope?: ParentNode): HTMLButtonElement;
function openMenu(): HTMLElement;
```

- [ ] **Step 2: Run the History structure test and verify RED**

Run: `npm test -- src/App.historyMenu.test.tsx -t "moves recent files out of File"`

Expected: FAIL because no top-level `History` button exists and the recent entries are still inside File.

- [ ] **Step 3: Add failing empty-state and localization tests**

```tsx
it("keeps History available and reports empty history", async () => {
  await renderApp();
  await click(button("History"));
  const empty = openMenu().querySelector<HTMLElement>('.menu-empty[role="menuitem"]');
  expect(empty?.textContent).toBe("No Recent Files");
  expect(empty?.getAttribute("aria-disabled")).toBe("true");
});

it("localizes the History menu in Japanese", async () => {
  window.localStorage.setItem("koharu-language", "ja");
  await renderApp();
  await click(button("履歴"));
  expect(openMenu().textContent).toContain("最近使ったファイルはありません");
});
```

- [ ] **Step 4: Run the new file and verify the additional tests fail for the missing labels**

Run: `npm test -- src/App.historyMenu.test.tsx`

Expected: FAIL at the first lookup for `History` or `履歴`.

- [ ] **Step 5: Implement the top-level History menu and move the existing actions**

In `src/App.tsx`, extend the menu ID and localized text:

```tsx
type MenuId = "file" | "history" | "view" | "settings" | "search" | "format" | "help";

// English
history: "History",
noRecentFiles: "No Recent Files",

// Japanese
history: "履歴",
noRecentFiles: "最近使ったファイルはありません",
```

Remove the recent-file fragment from File. Immediately after File, add a menu root that follows the existing open/click/hover pattern:

```tsx
<div
  className="menu-root"
  data-open={activeMenu === "history"}
  onMouseEnter={() => activeMenu && setActiveMenu("history")}
>
  <button
    className="menu-title"
    aria-expanded={activeMenu === "history"}
    onClick={() => setActiveMenu((menu) => (menu === "history" ? null : "history"))}
  >
    {text.history}
  </button>
  <div className="menu-popover history-menu-popover" role="menu">
    {recentFiles.length === 0 ? (
      <div className="menu-empty" role="menuitem" aria-disabled="true">
        {text.noRecentFiles}
      </div>
    ) : (
      <>
        {recentFiles.map((entry) => {
          const fileName = fileNameFromPath(entry.path);
          return (
            <div className="recent-file-row" key={entry.path.toLocaleLowerCase()}>
              <button
                role="menuitem"
                title={fileName}
                onClick={() => runMenuAction(() => requestDocumentTransition(() => openFilePath(entry.path, {
                  title: "File not found",
                  onFailure: () => setRecentFiles((history) => removeRecentFile(history, entry.path)),
                })))}
              >
                <span className="recent-file-name">{fileName}</span>
              </button>
              <button
                type="button"
                className="recent-file-remove"
                aria-label={`${text.removeRecentFile}: ${fileName}`}
                title={text.removeRecentFile}
                onClick={() => setRecentFiles((history) => removeRecentFile(history, entry.path))}
              >
                ×
              </button>
            </div>
          );
        })}
        <div className="menu-separator" />
        <button role="menuitem" onClick={() => setRecentFiles([])}>{text.clearRecentFiles}</button>
      </>
    )}
  </div>
</div>
```

- [ ] **Step 6: Implement bounded, single-line filename presentation**

In `src/styles.css`, replace the obsolete recent label/path rules with:

```css
.history-menu-popover {
  width: 280px;
  max-width: calc(100vw - 16px);
}

.recent-file-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  align-items: stretch;
}

.recent-file-row > button:first-child {
  display: block;
  min-width: 0;
  overflow: hidden;
}

.recent-file-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-file-row .recent-file-remove {
  width: 30px;
  padding: 0;
  text-align: center;
}
```

- [ ] **Step 7: Add failing behavior tests for open, remove, clear, and missing-file cleanup**

Add focused tests to `src/App.historyMenu.test.tsx` using the stored paths from Step 1:

```tsx
it("opens a recent file by its stored full path", async () => {
  seedRecent("C:\\notes\\open-me.md");
  tauriMocks.readTextFile.mockResolvedValueOnce({ path: "C:\\notes\\open-me.md", content: "opened" });
  await renderApp();
  await click(button("History"));
  await click(button("open-me.md", openMenu()));
  expect(tauriMocks.readTextFile).toHaveBeenCalledWith("C:\\notes\\open-me.md");
});

it("removes one entry and can clear the remainder", async () => {
  seedRecent("C:\\notes\\first.md", "C:\\notes\\second.md");
  await renderApp();
  await click(button("History"));
  await click(button("Remove from recent files: first.md", openMenu()));
  expect(openMenu().textContent).not.toContain("first.md");
  await click(button("Clear Recent Files", openMenu()));
  expect(JSON.parse(window.localStorage.getItem("koharu-recent-files") ?? "[]")).toEqual([]);
});

it("removes only a missing recent file after open fails", async () => {
  seedRecent("C:\\notes\\missing.md", "C:\\notes\\kept.md");
  tauriMocks.readTextFile.mockRejectedValueOnce(new Error("missing"));
  await renderApp();
  await click(button("History"));
  await click(button("missing.md", openMenu()));
  await flushEffects();
  const persisted = JSON.parse(window.localStorage.getItem("koharu-recent-files") ?? "[]");
  expect(persisted.map((entry: { path: string }) => entry.path)).toEqual(["C:\\notes\\kept.md"]);
});
```

Add harness utilities with exact signatures:

```tsx
function seedRecent(...paths: string[]): void;
async function flushEffects(): Promise<void>;
```

- [ ] **Step 8: Run the focused tests and make any minimal behavior corrections**

Run: `npm test -- src/App.historyMenu.test.tsx`

Expected: PASS with all History-menu tests green.

- [ ] **Step 9: Commit the History menu slice**

```powershell
git add -- src/App.historyMenu.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add compact history menu"
```

### Task 2: New Documents Enter Edit Mode After Approval

**Files:**
- Modify: `src/App.documentSessionSafety.test.tsx`
- Modify: `src/App.tsx:425-470`
- Modify: `src/App.tsx:685-691`
- Modify: `src/App.tsx:1064-1068`

**Interfaces:**
- Consumes: `handleNew(): Promise<void>`, `requestDocumentTransition(proceed)`, `editorMode`, `setEditorMode`, and storage key `koharu-editor-mode`.
- Produces: `skipNextEditorModePersistenceRef: MutableRefObject<boolean>` used only by successful New transitions and the editor-mode persistence effect.

- [ ] **Step 1: Write a failing successful-New regression test**

Add to `src/App.documentSessionSafety.test.tsx`:

```tsx
it("switches a successfully created blank document to Edit without replacing the saved startup mode", async () => {
  const switcher = container.querySelector<HTMLElement>(".view-mode-switcher");
  if (!switcher) throw new Error("View mode switcher not found");
  await click(button("Preview", switcher));
  expect(window.localStorage.getItem("koharu-editor-mode")).toBe("preview");

  await shortcut(window, "n");

  expect(switcher.getAttribute("data-mode")).toBe("edit");
  expect(editorContent()).toBe("");
  expect(window.localStorage.getItem("koharu-editor-mode")).toBe("preview");
});
```

- [ ] **Step 2: Run the successful-New test and verify RED**

Run: `npm test -- src/App.documentSessionSafety.test.tsx -t "switches a successfully created blank document"`

Expected: FAIL because the current New handler resets the document but leaves Preview active.

- [ ] **Step 3: Write a failing cancellation regression test**

```tsx
it("preserves Preview and the current document when New is canceled", async () => {
  await shortcut(window, "b");
  const contentBeforeNew = editorContent();
  const switcher = container.querySelector<HTMLElement>(".view-mode-switcher");
  if (!switcher) throw new Error("View mode switcher not found");
  await click(button("Preview", switcher));

  await shortcut(window, "n");
  const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error("Unsaved-decision dialog not found");
  await click(button("Cancel", dialog));
  await act(async () => { await Promise.resolve(); });

  expect(switcher.getAttribute("data-mode")).toBe("preview");
  expect(editorContent()).toBe(contentBeforeNew);
  expect(window.localStorage.getItem("koharu-editor-mode")).toBe("preview");
});
```

- [ ] **Step 4: Run both New tests and verify the cancellation test already protects the transition boundary**

Run: `npm test -- src/App.documentSessionSafety.test.tsx -t "New"`

Expected: one FAIL for successful New remaining in Preview and one PASS for canceled New preserving Preview.

- [ ] **Step 5: Implement successful-only Edit switching with one-shot persistence suppression**

Near the existing refs in `App.tsx`:

```tsx
const skipNextEditorModePersistenceRef = useRef(false);
```

Update `handleNew` so the mode change is inside the approved `proceed` callback:

```tsx
const handleNew = useCallback(async () => {
  if (actionGateRef.current.isBlocked()) return;
  await requestDocumentTransition(async () => {
    resetDocument();
    setEditorMode((mode) => {
      if (mode === "edit") return mode;
      skipNextEditorModePersistenceRef.current = true;
      return "edit";
    });
    return true;
  });
}, [requestDocumentTransition, resetDocument]);
```

Guard the existing persistence effect:

```tsx
useEffect(() => {
  if (skipNextEditorModePersistenceRef.current) {
    skipNextEditorModePersistenceRef.current = false;
    return;
  }
  writeStoredValue(EDITOR_MODE_STORAGE_KEY, editorMode);
}, [editorMode]);
```

- [ ] **Step 6: Run the New regression tests and verify GREEN**

Run: `npm test -- src/App.documentSessionSafety.test.tsx -t "New"`

Expected: PASS for both successful and canceled New cases.

- [ ] **Step 7: Run the complete document-session safety file**

Run: `npm test -- src/App.documentSessionSafety.test.tsx`

Expected: PASS with no failures or unhandled React warnings.

- [ ] **Step 8: Commit the New-mode behavior slice**

```powershell
git add -- src/App.documentSessionSafety.test.tsx src/App.tsx
git commit -m "feat: open new documents in edit mode"
```

### Task 3: Full Verification and Visual Acceptance

**Files:**
- Verify only: `src/App.tsx`, `src/styles.css`, `src/App.historyMenu.test.tsx`, `src/App.documentSessionSafety.test.tsx`

**Interfaces:**
- Consumes: the completed History menu and New-mode behavior.
- Produces: verification evidence; no new production API.

- [ ] **Step 1: Run formatting-sensitive and source sanity checks**

Run:

```powershell
git diff --check HEAD~2..HEAD
rg -n "recent-files-label|recent-file-row small" src
```

Expected: `git diff --check` exits 0, and `rg` finds no obsolete label/path-subtitle selectors or markup.

- [ ] **Step 2: Run the full automated test suite**

Run: `npm test`

Expected: PASS with zero failed tests.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite exit 0 and produce the normal `dist` output.

- [ ] **Step 4: Start the app for visual verification**

Run: `npm run dev`

Expected: Vite reports a local URL with no startup error. In the app, verify:

- File contains no recent-file list and stays short.
- History is immediately after File and switches by hover while another menu is open.
- A maximum-length recent list remains compact.
- A long filename is one line with an ellipsis; hovering it shows the complete filename.
- The remove button, Clear Recent Files, and empty message work in English and Japanese.
- New from both File and Ctrl+N changes Split/Preview to Edit after approval.
- Canceling the unsaved prompt leaves the existing document and mode unchanged.

- [ ] **Step 5: Inspect final scope**

Run:

```powershell
git status --short
git diff HEAD~2 -- src/App.tsx src/styles.css src/App.historyMenu.test.tsx src/App.documentSessionSafety.test.tsx
```

Expected: only the four planned implementation/test files differ from the pre-implementation commit, with no unrelated changes.
