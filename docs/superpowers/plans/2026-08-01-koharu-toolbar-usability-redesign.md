# Koharu Toolbar Usability Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Koharu's formatting toolbar understandable, safe, state-preserving, keyboard accessible, localized, and responsive without replacing the Markdown source editor.

**Architecture:** Keep formatting semantics in pure TypeScript and make React/CodeMirror thin consumers. Preserve the CodeMirror instance across view-mode changes, feed reactive formatting state into a grouped localized toolbar, and isolate responsive splitter decisions in testable helpers before wiring them into `App.tsx` and CSS.

**Tech Stack:** React 18, TypeScript, CodeMirror 6, Vitest, React DOM server rendering, Vite, Tauri 2, Rust

## Global Constraints

- Do not replace CodeMirror or introduce a WYSIWYG editor.
- Do not add runtime dependencies unless the approved design cannot be implemented with the existing stack.
- Every production behavior change starts with a failing test and one observed RED run.
- Every formatting command is one CodeMirror transaction and one Undo step.
- Preserve the document's LF or CRLF convention.
- Toolbar, Format menu, tooltips, placeholders, feedback, and Help must support Japanese and English.
- Keep existing document safety, recovery, Excalidraw, file lifecycle, and Mermaid export behavior intact.
- Do not update `src/buildInfo.ts` in feature commits; restore generated build timestamps after verification builds.

---

## File Structure

- Modify `src/markdownFormatting.ts`: semantic formatting commands, toggling, full-line expansion, safe block boundaries, EOL and fence handling, table conversion, and selection placement.
- Modify `src/markdownFormatting.test.ts`: exhaustive pure command behavior.
- Create `src/formattingUi.ts`: localized toolbar metadata, feedback text, format-menu metadata, code languages, and action grouping.
- Create `src/formattingUi.test.ts`: locale completeness and command/label consistency.
- Create `src/toolbarNavigation.ts`: pure roving-tabindex navigation.
- Create `src/toolbarNavigation.test.ts`: Arrow/Home/End behavior.
- Modify `src/components/MarkdownEditor.tsx`: apply semantic commands, report active formatting context, and preserve the CodeMirror view while hidden.
- Modify `src/components/MarkdownToolbar.tsx`: localized groups, heading/list/code menus, More menu, disabled/pressed state, feedback hooks, and roving focus.
- Modify `src/components/MarkdownToolbar.test.tsx`: server-rendered structure, localization, groups, menus, disabled state, and accessible metadata.
- Create `src/responsiveLayout.ts`: view-mode shortcut filtering and splitter orientation/geometry helpers.
- Create `src/responsiveLayout.test.ts`: shortcut, pointer, keyboard, and width-boundary behavior.
- Modify `src/App.tsx`: persistent editor mounting, shared commands, shortcut, responsive splitter, toolbar state, onboarding, feedback, and outline overlay.
- Modify `src/components/HelpDialog.tsx`: bilingual toolbar explanations and copyable examples.
- Modify `src/components/HelpDialog.test.tsx`: bilingual Help coverage.
- Modify `src/styles.css`: explicit interaction tokens, hierarchy, grouped toolbar, menus, focus ring, hidden editor, outline overlay, and narrow stacked layout.
- Keep `docs/superpowers/specs/2026-08-01-koharu-toolbar-usability-redesign.md` as the acceptance source.

---

### Task 1: Preserve the Quick Win baseline as a reviewable commit

**Files:**
- Include current Quick Win production and test changes already present in the worktree.
- Include `docs/superpowers/plans/2026-08-01-koharu-next-minor-update.md`.
- Exclude this redesign plan and the already committed redesign spec.

**Interfaces:**
- Consumes: existing uncommitted Preview, Recent Files, Outline, Toolbar, and Mermaid Export implementation.
- Produces: a clean feature baseline on which redesign commits can be reviewed independently.

- [ ] **Step 1: Run the existing complete baseline verification**

Run:

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

Expected: 102 frontend tests pass, 7 Rust tests pass, and Vite exits 0. Restore `src/buildInfo.ts` to its pre-build content if the build script changes only its timestamp.

- [ ] **Step 2: Inspect and stage only the Quick Win baseline**

Run:

```powershell
git status --short
git diff --check
git add src src-tauri/src/lib.rs docs/superpowers/plans/2026-08-01-koharu-next-minor-update.md
git diff --cached --name-only
```

Expected: staged paths contain the Quick Win implementation and tests, not `docs/superpowers/plans/2026-08-01-koharu-toolbar-usability-redesign.md`.

- [ ] **Step 3: Commit the verified baseline**

```powershell
git commit -m "feat: add Koharu quick win improvements"
```

---

### Task 2: Make inline formatting semantic, reversible, and EOL-safe

**Files:**
- Modify: `src/markdownFormatting.ts`
- Modify: `src/markdownFormatting.test.ts`

**Interfaces:**
- Consumes: document text and CodeMirror selection offsets.
- Produces:

```ts
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type CodeLanguage = "" | "markdown" | "javascript" | "typescript" | "json" | "rust" | "bash" | "powershell";
export type MarkdownCommand =
  | { kind: "bold" | "italic" | "strikethrough" | "link" | "inlineCode" }
  | { kind: "heading"; level: HeadingLevel }
  | { kind: "bulletList" | "numberedList" | "taskList" | "quote" | "table" | "mermaid" }
  | { kind: "codeBlock"; language: CodeLanguage };

export type FormatSelection = { from: number; to: number };
export type FormatResult = {
  from: number;
  to: number;
  insert: string;
  selectionStart: number;
  selectionEnd: number;
  feedback?: "codeBlockInserted" | "tableInserted" | "mermaidInserted";
  warning?: "multilineInlineCode";
};
export type FormattingContext = {
  headingLevel: HeadingLevel | null;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  inlineCode: boolean;
};

export function formatMarkdownSelection(
  document: string,
  selection: FormatSelection,
  command: MarkdownCommand,
): FormatResult;
export function detectFormattingContext(document: string, selection: FormatSelection): FormattingContext;
```

- [ ] **Step 1: Replace string-action tests with failing semantic-command tests**

Add literal assertions:

```ts
it("toggles bold delimiters without stacking them", () => {
  expect(formatMarkdownSelection("Koharu", { from: 0, to: 6 }, { kind: "bold" }).insert).toBe("**Koharu**");
  expect(formatMarkdownSelection("**Koharu**", { from: 2, to: 8 }, { kind: "bold" })).toMatchObject({
    from: 0,
    to: 10,
    insert: "Koharu",
  });
});

it("uses a longer inline-code delimiter when the selection contains a backtick", () => {
  expect(formatMarkdownSelection("a`b", { from: 0, to: 3 }, { kind: "inlineCode" }).insert).toBe("``a`b``");
});

it("rejects multiline inline code without replacing the selection", () => {
  expect(formatMarkdownSelection("one\r\ntwo", { from: 0, to: 8 }, { kind: "inlineCode" })).toMatchObject({
    from: 0,
    to: 8,
    insert: "one\r\ntwo",
    warning: "multilineInlineCode",
  });
});

it("uses one link contract for selected and placeholder text", () => {
  expect(formatMarkdownSelection("Koharu", { from: 0, to: 6 }, { kind: "link" })).toMatchObject({
    insert: "[Koharu](https://example.com)",
    selectionStart: 9,
    selectionEnd: 28,
  });
});

it("detects the active heading and inline wrapper at the caret", () => {
  expect(detectFormattingContext("## **Heading**", { from: 7, to: 7 })).toEqual({
    headingLevel: 2,
    bold: true,
    italic: false,
    strikethrough: false,
    inlineCode: false,
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- src/markdownFormatting.test.ts
```

Expected: FAIL because `MarkdownCommand` and the semantic signature do not exist.

- [ ] **Step 3: Implement delimiter detection and inline toggling**

Implement helpers with these exact contracts:

```ts
function detectEol(document: string): "\r\n" | "\n" {
  return document.includes("\r\n") ? "\r\n" : "\n";
}

function inlineDelimiter(content: string) {
  const longest = Math.max(0, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length));
  return "`".repeat(longest + 1);
}

function toggleWrapper(document: string, selection: FormatSelection, before: string, after: string, placeholder: string): FormatResult {
  const selected = document.slice(selection.from, selection.to);
  const outerFrom = selection.from - before.length;
  const outerTo = selection.to + after.length;
  if (outerFrom >= 0 && document.slice(outerFrom, selection.from) === before && document.slice(selection.to, outerTo) === after) {
    return { from: outerFrom, to: outerTo, insert: selected, selectionStart: 0, selectionEnd: selected.length };
  }
  const body = selected || placeholder;
  const insert = `${before}${body}${after}`;
  return {
    from: selection.from,
    to: selection.to,
    insert,
    selectionStart: selected ? before.length : before.length,
    selectionEnd: before.length + body.length,
  };
}
```

Use the same link result for toolbar and menu callers. Preserve selected text on warnings. Implement `detectFormattingContext` from the complete current line and the delimiters surrounding the primary selection; return all-false and `headingLevel: null` when formatting cannot be established safely.

- [ ] **Step 4: Run the focused tests and verify GREEN**

```powershell
npm test -- src/markdownFormatting.test.ts
```

Expected: all inline-formatting tests pass.

- [ ] **Step 5: Commit inline formatting behavior**

```powershell
git add src/markdownFormatting.ts src/markdownFormatting.test.ts
git commit -m "fix: make inline Markdown formatting reversible"
```

---

### Task 3: Make line and block commands structurally safe

**Files:**
- Modify: `src/markdownFormatting.ts`
- Modify: `src/markdownFormatting.test.ts`

**Interfaces:**
- Consumes: `MarkdownCommand`, `FormatSelection`, and `FormatResult` from Task 2.
- Produces: safe heading/list/quote toggles, fenced block insertion, TSV table conversion, and Mermaid insertion.

- [ ] **Step 1: Add failing full-line and block-boundary tests**

```ts
it("expands a partial selection to complete lines before making a task list", () => {
  const document = "Alpha\r\nBeta\r\nGamma";
  expect(formatMarkdownSelection(document, { from: 8, to: 10 }, { kind: "taskList" })).toMatchObject({
    from: 7,
    to: 11,
    insert: "- [ ] Beta",
  });
});

it("replaces an existing heading level instead of stacking markers", () => {
  expect(formatMarkdownSelection("## Heading", { from: 4, to: 8 }, { kind: "heading", level: 3 }).insert).toBe("### Heading");
});

it("adds safe LF block boundaries around a code block inserted mid-line", () => {
  expect(formatMarkdownSelection("beforeafter", { from: 6, to: 6 }, { kind: "codeBlock", language: "rust" }).insert).toBe(
    "\n\n```rust\ncode\n```\n\n",
  );
});

it("uses a longer fence when selected code contains triple backticks", () => {
  expect(formatMarkdownSelection("```\ninner\n```", { from: 0, to: 13 }, { kind: "codeBlock", language: "markdown" }).insert).toContain("````markdown");
});

it("converts tab-separated selected rows into a non-destructive table", () => {
  expect(formatMarkdownSelection("Name\tValue\nA\t1", { from: 0, to: 14 }, { kind: "table" }).insert).toBe(
    "| Name | Value |\n| --- | --- |\n| A | 1 |",
  );
});

it("preserves a non-tabular selection and inserts the table after it", () => {
  const result = formatMarkdownSelection("Keep me", { from: 0, to: 7 }, { kind: "table" });
  expect(result.insert).toContain("Keep me");
  expect(result.insert).toContain("| Column 1 | Column 2 |");
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
npm test -- src/markdownFormatting.test.ts
```

Expected: FAIL on partial-line expansion, EOL preservation, toggling, safe fences, and table behavior.

- [ ] **Step 3: Implement line-boundary and safe-block helpers**

```ts
function lineBounds(document: string, selection: FormatSelection) {
  const startBreak = Math.max(document.lastIndexOf("\n", Math.max(0, selection.from - 1)), document.lastIndexOf("\r", Math.max(0, selection.from - 1)));
  const from = startBreak === -1 ? 0 : startBreak + 1;
  const nextLf = document.indexOf("\n", selection.to);
  const nextCr = document.indexOf("\r", selection.to);
  const candidates = [nextLf, nextCr].filter((value) => value >= 0);
  const to = candidates.length === 0 ? document.length : Math.min(...candidates);
  return { from, to };
}

function fenceFor(content: string) {
  const longest = Math.max(2, ...Array.from(content.matchAll(/`{3,}/g), (match) => match[0].length));
  return "`".repeat(longest + 1);
}
```

Implement prefix replacement for heading, quote, bullet, numbered, and task markers. Preserve the source EOL. For a non-tabular table selection, keep the selection before the new template rather than overwriting it.

- [ ] **Step 4: Run focused tests and verify GREEN**

```powershell
npm test -- src/markdownFormatting.test.ts
```

Expected: all formatting tests pass, including CRLF and non-destructive table cases.

- [ ] **Step 5: Commit structural formatting safety**

```powershell
git add src/markdownFormatting.ts src/markdownFormatting.test.ts
git commit -m "fix: make block Markdown insertion structurally safe"
```

---

### Task 4: Preserve CodeMirror state and replace the conflicting mode shortcut

**Files:**
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/App.tsx`
- Create: `src/responsiveLayout.ts`
- Create: `src/responsiveLayout.test.ts`
- Modify: `src/viewMode.test.ts`

**Interfaces:**
- Consumes: `MarkdownCommand`, `FormatResult`, and `FormattingContext` from Tasks 2–3.
- Produces:

```ts
export function shouldCycleViewMode(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key: string;
  isComposing: boolean;
}): boolean;
```

- [ ] **Step 1: Add failing shortcut and mounted-editor tests**

```ts
it("uses Ctrl or Command plus Alt+M for mode cycling", () => {
  expect(shouldCycleViewMode({ ctrlKey: true, metaKey: false, altKey: true, shiftKey: false, key: "m", isComposing: false })).toBe(true);
  expect(shouldCycleViewMode({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: "v", isComposing: false })).toBe(false);
});

it("does not cycle during IME composition", () => {
  expect(shouldCycleViewMode({ ctrlKey: true, metaKey: false, altKey: true, shiftKey: false, key: "m", isComposing: true })).toBe(false);
});
```

Extend a server-rendered app shell or extract a pure visibility model and assert that Preview returns `{ editorMounted: true, editorVisible: false, previewVisible: true }`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm test -- src/responsiveLayout.test.ts src/viewMode.test.ts
```

Expected: FAIL because the shortcut helper and persistent-editor visibility model do not exist.

- [ ] **Step 3: Implement persistent mounting and semantic command dispatch**

Keep `MarkdownEditor` rendered for all three modes and add `onFormattingContextChange(context: FormattingContext): void` to `MarkdownEditorProps`. Call it from CodeMirror updates whenever the document or selection changes:

```tsx
<article className="editor-pane" hidden={editorMode === "preview"} aria-hidden={editorMode === "preview"}>
  <MarkdownToolbar disabled={isDocumentSafetyActive} />
  <MarkdownEditor ref={editorRef} value={content} mode="source" themeMode={themeMode} readOnly={isDocumentSafetyActive} onChange={handleContentChange} onFormattingContextChange={setFormattingContext} />
</article>
```

Do not conditionally remove `MarkdownEditor`. Update `MarkdownEditorHandle.applyFormat(command: MarkdownCommand)` to dispatch the pure `FormatResult` once and restore focus. Replace the window Ctrl/Cmd+Shift+V handler with `shouldCycleViewMode(event)`.

- [ ] **Step 4: Run focused and editor tests**

```powershell
npm test -- src/responsiveLayout.test.ts src/viewMode.test.ts src/components/MarkdownEditorSafety.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit state preservation and shortcut behavior**

```powershell
git add src/App.tsx src/components/MarkdownEditor.tsx src/responsiveLayout.ts src/responsiveLayout.test.ts src/viewMode.test.ts
git commit -m "fix: preserve editor state across preview mode"
```

---

### Task 5: Build the localized grouped toolbar and unified Format menu

**Files:**
- Create: `src/formattingUi.ts`
- Create: `src/formattingUi.test.ts`
- Create: `src/toolbarNavigation.ts`
- Create: `src/toolbarNavigation.test.ts`
- Modify: `src/components/MarkdownToolbar.tsx`
- Modify: `src/components/MarkdownToolbar.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppLanguage`, `MarkdownCommand`, `HeadingLevel`, and `CodeLanguage`.
- Produces:

```ts
export type FormattingUi = {
  toolbarLabel: string;
  groups: { text: string; block: string; insert: string };
  actions: Record<string, { label: string; tooltip: string; short: string }>;
  feedback: Record<"codeBlockInserted" | "tableInserted" | "mermaidInserted" | "multilineInlineCode", string>;
};
export function getFormattingUi(language: AppLanguage): FormattingUi;
export function nextToolbarIndex(current: number, count: number, key: "ArrowLeft" | "ArrowRight" | "Home" | "End"): number;
```

- [ ] **Step 1: Add failing locale, structure, and keyboard tests**

```ts
it("provides Japanese labels and explanatory tooltips", () => {
  const ui = getFormattingUi("ja");
  expect(ui.actions.inlineCode.label).toBe("文中コード");
  expect(ui.actions.codeBlock.label).toBe("コードブロック");
  expect(ui.actions.table.tooltip).toContain("プレビューでは表");
});

it("wraps roving focus and supports Home and End", () => {
  expect(nextToolbarIndex(0, 5, "ArrowLeft")).toBe(4);
  expect(nextToolbarIndex(4, 5, "ArrowRight")).toBe(0);
  expect(nextToolbarIndex(2, 5, "Home")).toBe(0);
  expect(nextToolbarIndex(2, 5, "End")).toBe(4);
});
```

Update `MarkdownToolbar.test.tsx` to assert three `role="group"` names, Heading/List/Code menus, localized accessible names, `aria-keyshortcuts`, disabled controls, and a More menu containing Strikethrough/Table/Mermaid duplicates for narrow layouts.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm test -- src/formattingUi.test.ts src/toolbarNavigation.test.ts src/components/MarkdownToolbar.test.tsx
```

Expected: FAIL because localized metadata, grouped markup, menus, and roving navigation are absent.

- [ ] **Step 3: Implement localized metadata and grouped controls**

Use `getFormattingUi(language)` as the only text source. Render:

```tsx
<div className="markdown-toolbar" role="toolbar" aria-label={ui.toolbarLabel} onKeyDown={handleToolbarKeyDown}>
  <div role="group" aria-label={ui.groups.text}>{/* heading, bold, italic, strike, link, inline code */}</div>
  <div role="group" aria-label={ui.groups.block}>{/* quote, list menu, code language menu */}</div>
  <div role="group" aria-label={ui.groups.insert}>{/* table, Mermaid, More */}</div>
</div>
```

Heading menu emits levels 1–6. List menu emits bullet, numbered, or task commands. Code menu emits the exact language union from Task 2. Buttons use the shared semantic commands; remove duplicate `wrapSelection` menu behavior from `App.tsx`.

- [ ] **Step 4: Implement roving tabindex and disabled state**

Maintain one toolbar index with `tabIndex={index === activeIndex ? 0 : -1}`. Arrow/Home/End use `nextToolbarIndex`, focus the target button, and call `preventDefault()`. Apply native `disabled` and `aria-disabled` when document safety is active. Use `aria-pressed` only when the active formatting context is known.

- [ ] **Step 5: Run focused tests and full frontend tests**

```powershell
npm test -- src/formattingUi.test.ts src/toolbarNavigation.test.ts src/components/MarkdownToolbar.test.tsx
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit the toolbar and menu redesign**

```powershell
git add src/formattingUi.ts src/formattingUi.test.ts src/toolbarNavigation.ts src/toolbarNavigation.test.ts src/components/MarkdownToolbar.tsx src/components/MarkdownToolbar.test.tsx src/App.tsx
git commit -m "feat: redesign the Markdown formatting toolbar"
```

---

### Task 6: Correct responsive splitter behavior and visual hierarchy

**Files:**
- Modify: `src/responsiveLayout.ts`
- Modify: `src/responsiveLayout.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/components/ViewModeSwitcher.test.tsx`
- Modify: `src/components/OutlinePanel.test.tsx`

**Interfaces:**
- Consumes: the shortcut helper module from Task 4 and grouped toolbar classes from Task 5.
- Produces:

```ts
export type SplitOrientation = "vertical" | "horizontal";
export function splitOrientationForWidth(width: number): SplitOrientation;
export function splitPercentFromPointer(input: {
  orientation: SplitOrientation;
  clientX: number;
  clientY: number;
  left: number;
  top: number;
  width: number;
  height: number;
}): number;
export function splitPercentFromKey(current: number, orientation: SplitOrientation, key: string): number | null;
```

- [ ] **Step 1: Add failing orientation and geometry tests**

```ts
it("uses vertical splitting above 820px and horizontal stacking at 820px", () => {
  expect(splitOrientationForWidth(821)).toBe("vertical");
  expect(splitOrientationForWidth(820)).toBe("horizontal");
});

it("uses Y geometry and Up/Down keys for the stacked splitter", () => {
  expect(splitPercentFromPointer({ orientation: "horizontal", clientX: 0, clientY: 300, left: 0, top: 100, width: 800, height: 400 })).toBe(50);
  expect(splitPercentFromKey(50, "horizontal", "ArrowUp")).toBe(48);
  expect(splitPercentFromKey(50, "horizontal", "ArrowRight")).toBeNull();
});
```

- [ ] **Step 2: Run responsive tests and verify RED**

```powershell
npm test -- src/responsiveLayout.test.ts src/components/ViewModeSwitcher.test.tsx src/components/OutlinePanel.test.tsx
```

Expected: FAIL because pointer/key helpers and explicit tokens do not exist.

- [ ] **Step 3: Implement orientation-aware splitter wiring**

Track `matchMedia("(max-width: 820px)")` in `App.tsx`. Set `aria-orientation` from orientation, call `splitPercentFromPointer`, and accept Left/Right only for vertical splitting and Up/Down only for horizontal splitting. Use a CSS custom property for the percentage so grid columns and stacked rows share one value.

- [ ] **Step 4: Define explicit interaction and hierarchy tokens**

Add tokens in both theme scopes:

```css
--accent-soft: color-mix(in srgb, var(--accent) 16%, var(--pane-bg));
--selected-fg: var(--text);
--focus-ring: #2563eb;
--hover-bg: var(--active-bg);
--disabled-fg: color-mix(in srgb, var(--muted) 70%, transparent);
```

Add a shared 2px `:focus-visible` ring with 2px offset. Ensure hover, focus, pressed, and disabled styles are distinct. Give menu, pane header, and toolbar different surfaces. Normalize editor, preview, and outline header height and close-button hit area.

- [ ] **Step 5: Implement medium outline overlay and More-menu breakpoints**

Use these exact ranges:

```css
@media (min-width: 821px) and (max-width: 1100px) { /* outline absolute overlay */ }
@media (max-width: 960px) { /* hide low-frequency direct actions; show More */ }
@media (max-width: 820px) { /* stacked editor/preview and horizontal separator */ }
```

The overlay must not reduce workspace width and must remain closable and keyboard reachable.

- [ ] **Step 6: Run tests and build**

```powershell
npm test -- src/responsiveLayout.test.ts src/components/ViewModeSwitcher.test.tsx src/components/OutlinePanel.test.tsx
npm test
npm run build
```

Expected: tests pass and build exits 0. Restore build timestamp metadata before commit.

- [ ] **Step 7: Commit responsive and visual fixes**

```powershell
git add src/responsiveLayout.ts src/responsiveLayout.test.ts src/App.tsx src/styles.css src/components/ViewModeSwitcher.test.tsx src/components/OutlinePanel.test.tsx
git commit -m "fix: align responsive layout and interaction states"
```

---

### Task 7: Add beginner guidance, feedback, and bilingual Help

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/HelpDialog.tsx`
- Modify: `src/components/HelpDialog.test.tsx`
- Create: `src/formattingGuidance.ts`
- Create: `src/formattingGuidance.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: feedback keys and localized text from `formattingUi.ts`.
- Produces:

```ts
export const TOOLBAR_HINT_STORAGE_KEY = "koharu-toolbar-hint-dismissed";
export function shouldShowToolbarHint(storedValue: string | null): boolean;
```

- [ ] **Step 1: Add failing guidance and Help tests**

```ts
it("shows the toolbar hint until the local dismissal flag is true", () => {
  expect(shouldShowToolbarHint(null)).toBe(true);
  expect(shouldShowToolbarHint("false")).toBe(true);
  expect(shouldShowToolbarHint("true")).toBe(false);
});
```

Add Japanese Help assertions for `文中コード`, `コードブロック`, `チェックリスト`, `表`, `図（Mermaid）`, and the generated Markdown examples. Add matching English assertions for `Inline code`, `Code block`, `Task list`, `Table`, and `Mermaid diagram`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm test -- src/formattingGuidance.test.ts src/components/HelpDialog.test.tsx
```

Expected: FAIL because the hint helper and complete bilingual toolbar Help do not exist.

- [ ] **Step 3: Implement the dismissible first-use hint**

Initialize state from `shouldShowToolbarHint(localStorage.getItem(TOOLBAR_HINT_STORAGE_KEY))`. Render near the toolbar in Edit/Split:

```tsx
<aside className="toolbar-hint" aria-label={text.toolbarHintTitle}>
  <span>{text.toolbarHintBody}</span>
  <button type="button" onClick={dismissToolbarHint}>{text.dismiss}</button>
</aside>
```

Dismissal stores `"true"` locally and never changes document content.

- [ ] **Step 4: Add non-blocking insertion feedback**

When `FormatResult.feedback` exists, set a localized message in:

```tsx
<span className="formatting-feedback" aria-live="polite">{formattingFeedback}</span>
```

Table feedback tells users to edit the first column heading. Code Block feedback tells users to select a language and edit the code placeholder. Mermaid feedback tells users to edit the flowchart source and use Split for the result. A multiline inline-code warning leaves source unchanged and explains that Code Block should be used.

- [ ] **Step 5: Implement bilingual Help sections with copyable source examples**

Document the three toolbar groups and include literal Markdown examples for bold, task list, inline code, code block, table, and Mermaid. Do not open or replace the user's document.

- [ ] **Step 6: Run focused and full frontend tests**

```powershell
npm test -- src/formattingGuidance.test.ts src/components/HelpDialog.test.tsx
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit guidance and Help**

```powershell
git add src/App.tsx src/components/HelpDialog.tsx src/components/HelpDialog.test.tsx src/formattingGuidance.ts src/formattingGuidance.test.ts src/styles.css
git commit -m "feat: add bilingual formatting guidance"
```

---

### Task 8: Run regression, browser, native, and release verification

**Files:**
- Modify only files required by defects reproduced during this task; each defect must receive a failing regression test before its fix.

**Interfaces:**
- Consumes: complete implementation from Tasks 1–7.
- Produces: fresh evidence for the acceptance criteria and release artifacts.

- [ ] **Step 1: Run all automated tests and static production build**

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
git diff --check
```

Expected: zero failures and exit code 0 for every command. Chunk-size warnings are non-fatal. Restore `src/buildInfo.ts` if only generated timestamp values changed.

- [ ] **Step 2: Browser-test the critical UI flows**

Start Vite on an available test port and use Playwright CLI to verify:

1. Japanese and English toolbar labels.
2. Three visible groups at wide width.
3. More menu at 960px.
4. Outline overlay at 1000px.
5. Stacked Split at 820px with horizontal separator semantics.
6. Table/Mermaid/Code Block inserted at a line midpoint remain valid blocks.
7. Preview hides but does not destroy the editor; browser-visible content, selection, and scroll survive the round trip.
8. Keyboard toolbar traversal and visible focus ring.
9. Light and dark pressed/hover/focus/disabled states.

Capture artifacts under `output/playwright/`, inspect console errors, then remove temporary artifacts after reporting results.

- [ ] **Step 3: Run native smoke tests**

Use a disposable Markdown file and verify:

1. Ctrl+Shift+V still performs native paste-as-plain-text.
2. Ctrl+Alt+M cycles Edit/Split/Preview.
3. Undo/Redo, caret, selection, and editor scroll survive Preview round trips.
4. Document-safety state disables toolbar controls visibly.
5. Recent Files missing paths remain recoverable.
6. Mermaid PNG/SVG export remains functional.

- [ ] **Step 4: Build release executable and installers**

Confirm `koharu.exe` is not running, then run:

```powershell
npm run tauri build
Get-Item target/release/koharu.exe
Get-ChildItem target/release/bundle -Recurse -File
```

Expected: Tauri exits 0 and produces `target/release/koharu.exe`, MSI, and NSIS artifacts. Restore generated `src/buildInfo.ts` timestamp content before final source inspection.

- [ ] **Step 5: Inspect acceptance coverage and repository state**

```powershell
git status --short
git diff --check
git log --oneline -8
```

Re-read `docs/superpowers/specs/2026-08-01-koharu-toolbar-usability-redesign.md` and map every acceptance criterion to automated or smoke-test evidence. Report any native-only limitation explicitly.

- [ ] **Step 6: Commit verification-only regression fixes when present**

If Task 8 produced tested fixes, stage only those source and regression-test files and commit:

```powershell
git commit -m "test: cover toolbar usability regressions"
```

If no source changes were required, do not create an empty commit.
