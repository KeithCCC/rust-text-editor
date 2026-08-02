# Koharu Compact Pane Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce normal editor and preview pane headers to approximately 24px, remove the duplicated top file path, and keep the complete path accessible in a single-line bottom status item.

**Architecture:** `App` keeps file identity in the existing window title and status bar while simplifying the editor pane header to its label and formatting-toolbar toggle. Dedicated semantic classes distinguish the compact header, search-expanded exception, and shrinkable status path; CSS owns sizing and truncation without changing document state or file operations.

**Tech Stack:** React 18, TypeScript, Vitest, jsdom, CSS Flexbox/Grid, Playwright CLI, Vite/Tauri

## Global Constraints

- The normal pane-header target is approximately 24px, about half the previous 44px height.
- The editor header must not display a file path or untitled value.
- The complete localized file status remains visible as real text in the bottom status bar and is repeated in its `title` tooltip.
- Long paths truncate visually without wrapping or displacing save state, preview state, statistics, or build information.
- Editor and preview headers align in Split mode.
- The formatting-toolbar toggle retains localized labels, `aria-expanded`, `aria-controls`, pointer, keyboard, and assistive-technology behavior.
- Split mode retains the existing icon-only toggle treatment.
- An open in-document search may expand the editor header beyond 24px.
- Do not alter document titles, file operations, toolbar commands, preview rendering, or status values.
- Produce fresh Windows EXE, MSI, and NSIS artifacts after verification.

---

### Task 1: Compact Pane Headers and Status-Path Ownership

**Files:**
- Modify: `src/App.tsx:490-520,1511-1533,1634-1642,1658-1665`
- Modify: `src/styles.css:762-814,1471-1492`
- Modify: `src/App.documentSessionSafety.test.tsx:130-275`

**Interfaces:**
- Consumes: existing `currentFile`, localized `text.fileStatus`, `text.untitled`, `isNoteSearchVisible`, and `isSplitMode` state.
- Produces: `.pane-header.has-note-search`, simplified `.pane-title`, `.statusbar-file`, and a shared `fileStatusText` display value.

- [ ] **Step 1: Write failing App integration tests for path ownership and compact structure**

Add these tests to `src/App.documentSessionSafety.test.tsx`:

```tsx
it("keeps untitled file identity in the status bar instead of the editor header", () => {
  const pane = editorPane();
  const paneTitle = pane.querySelector<HTMLElement>(".pane-title");
  const statusFile = container.querySelector<HTMLElement>(".statusbar-file");
  if (!paneTitle || !statusFile) throw new Error("File identity regions not found");

  expect(paneTitle.textContent).toBe("Editor");
  expect(paneTitle.querySelector("small")).toBeNull();
  expect(statusFile.textContent).toBe("File: Untitled");
  expect(statusFile.title).toBe("File: Untitled");
});

it("keeps a long opened path only in the shrinkable status item", async () => {
  const path = "C:\\notes\\a-very-long-folder-name\\another-long-folder-name\\compact-header.md";
  dialogMocks.open.mockResolvedValueOnce(path);
  tauriMocks.readTextFile.mockResolvedValueOnce({ path, content: "# Compact" });

  await shortcut(window, "o");

  const pane = editorPane();
  const statusFile = container.querySelector<HTMLElement>(".statusbar-file");
  if (!statusFile) throw new Error("Status file item not found");
  expect(pane.querySelector(".pane-title")?.textContent).toBe("Editor");
  expect(pane.textContent).not.toContain(path);
  expect(statusFile.textContent).toBe(`File: ${path}`);
  expect(statusFile.title).toBe(`File: ${path}`);
});

it("marks only an active search header as expanded", async () => {
  const pane = editorPane();
  const header = pane.querySelector<HTMLElement>(".pane-header");
  if (!header) throw new Error("Editor header not found");
  expect(header.classList.contains("has-note-search")).toBe(false);

  await shortcut(window, "f");

  expect(header.classList.contains("has-note-search")).toBe(true);
  expect(header.querySelector('[role="search"]')).not.toBeNull();
});
```

Mutation check before writing implementation: restoring `<small>{currentFile ?? text.untitled}</small>` must fail the first two tests; removing the status `title` must fail both tooltip assertions; removing the search class must fail the third test.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/App.documentSessionSafety.test.tsx`

Expected: the three new tests FAIL because the header still contains file identity, `.statusbar-file` and its tooltip do not exist, and the header has no search-expanded class.

- [ ] **Step 3: Centralize status text and simplify the editor header**

Near the existing statistics and outline derived values in `App`, derive the localized status text once:

```ts
const fileStatusText = currentFile
  ? `${text.fileStatus} ${currentFile}`
  : `${text.fileStatus} ${text.untitled}`;
```

Change the editor header and title to:

```tsx
<header className={`pane-header${isNoteSearchVisible ? " has-note-search" : ""}`}>
  <div className="pane-title">
    <span>{text.editor}</span>
  </div>
  {/* Keep the existing formatting-toolbar toggle unchanged here. */}
```

Remove only the `<small>{currentFile ?? text.untitled}</small>` element. Do not change the window-title synchronization or preview header contents.

- [ ] **Step 4: Give the bottom file item explicit ownership and a full tooltip**

Replace the first footer item with:

```tsx
<span className="statusbar-file" title={fileStatusText}>
  {fileStatusText}
</span>
```

Keep all following status items and their order unchanged.

- [ ] **Step 5: Implement the 24px normal header and compact toggle CSS**

Replace the relevant rules with:

```css
.pane-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 24px;
  padding: 1px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--pane-header-bg);
}

.pane-header.has-note-search {
  min-height: 44px;
  padding: 6px 12px;
}

.pane-title {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}

.pane-header span {
  font-size: var(--ui-font-size);
  font-weight: 700;
  line-height: 20px;
}

.formatting-toolbar-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  min-height: 22px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-bg);
  color: var(--text);
  font-size: var(--ui-font-size);
  line-height: 18px;
}
```

Remove the obsolete `.pane-header small` rule only after the JSX no longer emits that element. Preserve `.formatting-toolbar-toggle.is-compact .formatting-toolbar-toggle-label` unchanged.

- [ ] **Step 6: Make the status file the only shrinkable status item**

Replace the positional first-child rule with the semantic class:

```css
.statusbar-file {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.statusbar > span:not(.statusbar-file) {
  flex: 0 0 auto;
  white-space: nowrap;
}
```

Keep `.statusbar` itself single-line and retain the existing build-item rule.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- src/App.documentSessionSafety.test.tsx src/formattingToolbarPreference.test.ts src/components/FormattingFeedback.test.tsx
npx tsc --noEmit
git diff --check
```

Expected: focused tests PASS, TypeScript exits 0, and `git diff --check` is silent.

- [ ] **Step 8: Commit the compact header behavior**

```powershell
git add -- src/App.tsx src/styles.css src/App.documentSessionSafety.test.tsx
git commit -m "feat: compact editor pane headers"
```

---

### Task 2: Visual, Regression, and Windows Artifact Verification

**Files:**
- Verify: `src/App.tsx`, `src/styles.css`, `src/App.documentSessionSafety.test.tsx`
- Verify: `src/buildInfo.ts` remains tracked-clean after generated build metadata is restored
- Generate: `target/release/koharu.exe`
- Generate: `target/release/bundle/msi/Koharu_1.0.0_x64_en-US.msi`
- Generate: `target/release/bundle/nsis/Koharu_1.0.0_x64-setup.exe`

**Interfaces:**
- Consumes: Task 1 compact header and status-path DOM/CSS contracts.
- Produces: fresh automated, visual, and packaged-build evidence for the final committed tree.

- [ ] **Step 1: Run focused and full frontend verification**

Run:

```powershell
npm test -- src/App.documentSessionSafety.test.tsx src/formattingToolbarPreference.test.ts src/components/FormattingFeedback.test.tsx
npm test
npx tsc --noEmit
npm run build
```

Expected: all focused and full tests PASS, TypeScript exits 0, and Vite exits 0. The repository's existing large-chunk advisory is acceptable; new warnings are not.

- [ ] **Step 2: Restore generated build metadata before packaging if needed**

Run: `git diff -- src/buildInfo.ts`

If only generated build-number and timestamp values changed, restore the committed values with an `apply_patch` edit. Do not use checkout, restore, or reset commands.

- [ ] **Step 3: Perform Playwright desktop visual verification**

Use the Playwright CLI skill and a hidden Vite server. At approximately 1440x980, verify and capture screenshots under `output/playwright/` for:

1. Edit: header is approximately 24px and contains `Editor` plus the toolbar toggle, with no path.
2. Split: editor and preview header borders align and the editor toggle is icon-only.
3. Preview: preview header remains compact and readable.
4. Long path: the bottom status path truncates without moving other status items; its DOM `title` contains the complete localized value.
5. Search open: the editor header expands and all search controls remain operable.
6. Japanese and English: pane and toggle labels remain localized.
7. Browser console: no errors or warnings attributable to this change.

Record measured `getBoundingClientRect().height` values for the editor header, preview header, and status bar; normal pane headers must be approximately 24px and Split values must match.

- [ ] **Step 4: Build fresh Windows artifacts**

Run: `npm run tauri build`

Expected: exit 0 and fresh artifacts at:

```text
target/release/koharu.exe
target/release/bundle/msi/Koharu_1.0.0_x64_en-US.msi
target/release/bundle/nsis/Koharu_1.0.0_x64-setup.exe
```

Record each artifact's absolute path, size, and last-modified timestamp.

- [ ] **Step 5: Restore generated metadata and remove transient browser artifacts**

After packaging, restore `src/buildInfo.ts` with `apply_patch` if it differs only by generated metadata. Close Playwright and Vite processes. Remove or move only the exact generated `.playwright-cli/` and `output/` directories after validating their resolved paths are inside the worktree.

- [ ] **Step 6: Run the final committed-tree gate**

Run:

```powershell
npm test
npx tsc --noEmit
git diff --check
git diff --exit-code -- src/buildInfo.ts
git status --short --untracked-files=all
```

Expected: 0 test failures; TypeScript exit 0; whitespace check silent; `src/buildInfo.ts` unchanged; worktree clean.

- [ ] **Step 7: Record verification evidence**

Write the exact command results, test counts, measured heights, artifact paths/sizes/timestamps, process cleanup, and repository checks into this plan's ignored SDD report. This verification-only task needs no commit unless a tracked correction is required; any correction must be test-driven, committed, and re-verified.
