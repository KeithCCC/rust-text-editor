# Koharu Collapsible Formatting Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users persistently hide the formatting toolbar and move formatting messages to the bottom of the editor pane so more vertical space remains available for writing.

**Architecture:** `App` owns the visible/hidden state because it coordinates the pane header, toolbar, editor, and message area. A focused `formattingToolbarPreference` module validates and stores the preference without allowing storage failures to break startup. The toolbar and message area become separate grid rows, with the message area rendered after the editor to align visual and accessible reading order.

**Tech Stack:** React 18, TypeScript, Vitest, jsdom, CSS Grid, browser `localStorage`, Vite/Tauri

## Global Constraints

- The toolbar is visible when no valid saved preference exists.
- The user's explicit choice persists across application restarts.
- The toggle is in the existing editor pane header and adds no new horizontal row.
- The message area is below the editor and directly above the global status bar.
- Empty feedback and hint state consumes no visible height.
- Edit and Split modes expose the control; Preview-only mode keeps the editor pane hidden.
- Japanese and English labels, keyboard operation, `aria-expanded`, and `aria-controls` are required.
- Storage failures are silent and fall back to the in-memory/default state.
- Do not change Markdown command behavior, the global status bar, or document persistence.

---

### Task 1: Safe Formatting Toolbar Preference

**Files:**
- Create: `src/formattingToolbarPreference.ts`
- Create: `src/formattingToolbarPreference.test.ts`

**Interfaces:**
- Consumes: `Storage`-compatible `getItem(key)` and `setItem(key, value)` methods.
- Produces: `FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY`, `readFormattingToolbarVisibility(storage?: Pick<Storage, "getItem">): boolean`, and `writeFormattingToolbarVisibility(visible: boolean, storage?: Pick<Storage, "setItem">): void`.

- [ ] **Step 1: Write the failing preference tests**

Create `src/formattingToolbarPreference.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY,
  readFormattingToolbarVisibility,
  writeFormattingToolbarVisibility,
} from "./formattingToolbarPreference";

describe("formatting toolbar preference", () => {
  it("defaults to visible unless storage contains a recognized value", () => {
    const storage = { getItem: vi.fn() };
    for (const [stored, expected] of [[null, true], ["visible", true], ["hidden", false], ["broken", true]] as const) {
      storage.getItem.mockReturnValueOnce(stored);
      expect(readFormattingToolbarVisibility(storage)).toBe(expected);
    }
    expect(FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY).toBe("koharu-formatting-toolbar-visibility");
  });

  it("falls back to visible when storage cannot be read", () => {
    expect(readFormattingToolbarVisibility({ getItem: () => { throw new Error("denied"); } })).toBe(true);
  });

  it("writes only the recognized visible and hidden values without surfacing storage errors", () => {
    const setItem = vi.fn();
    writeFormattingToolbarVisibility(false, { setItem });
    writeFormattingToolbarVisibility(true, { setItem });
    expect(setItem.mock.calls).toEqual([
      [FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY, "hidden"],
      [FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY, "visible"],
    ]);
    expect(() => writeFormattingToolbarVisibility(false, {
      setItem: () => { throw new Error("denied"); },
    })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/formattingToolbarPreference.test.ts`

Expected: FAIL because `./formattingToolbarPreference` does not exist.

- [ ] **Step 3: Implement the minimal safe preference module**

Create `src/formattingToolbarPreference.ts`:

```ts
export const FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY = "koharu-formatting-toolbar-visibility";

export function readFormattingToolbarVisibility(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): boolean {
  try {
    return storage.getItem(FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY) !== "hidden";
  } catch {
    return true;
  }
}

export function writeFormattingToolbarVisibility(
  visible: boolean,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  try {
    storage.setItem(FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY, visible ? "visible" : "hidden");
  } catch {
    // A display preference must not interrupt editing when storage is unavailable.
  }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/formattingToolbarPreference.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the preference unit**

```powershell
git add -- src/formattingToolbarPreference.ts src/formattingToolbarPreference.test.ts
git commit -m "feat: persist formatting toolbar visibility"
```

---

### Task 2: Header Toggle and Bottom Message DOM Order

**Files:**
- Modify: `src/App.tsx:100-270,350-430,1473-1546`
- Modify: `src/App.documentSessionSafety.test.tsx:1-130` and append focused layout tests
- Modify: `src/styles.css:593-668,750-790,1930-1950`

**Interfaces:**
- Consumes: `readFormattingToolbarVisibility()` and `writeFormattingToolbarVisibility(visible)` from Task 1.
- Produces: header button `.formatting-toolbar-toggle`, controlled region `#formatting-toolbar-region`, bottom container `.editor-message-area`, and the compact grid layout for those elements.

- [ ] **Step 1: Add failing integration tests for default state, toggle, persistence, language, and DOM order**

Add a helper beside the existing `button` helper in `src/App.documentSessionSafety.test.tsx`:

```ts
function editorPane() {
  const pane = container.querySelector<HTMLElement>(".editor-pane");
  if (!pane) throw new Error("Editor pane not found");
  return pane;
}
```

Add these tests inside the existing describe block:

```ts
it("toggles the formatting toolbar from the pane header and persists the choice", async () => {
  const toggle = button("Hide formatting toolbar", editorPane());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(toggle.getAttribute("aria-controls")).toBe("formatting-toolbar-region");
  expect(editorPane().querySelector("#formatting-toolbar-region")).not.toBeNull();

  await click(toggle);

  expect(button("Show formatting toolbar", editorPane()).getAttribute("aria-expanded")).toBe("false");
  expect(editorPane().querySelector("#formatting-toolbar-region")).toBeNull();
  expect(window.localStorage.getItem("koharu-formatting-toolbar-visibility")).toBe("hidden");
});

it("restores a hidden formatting toolbar preference on mount", async () => {
  act(() => root.unmount());
  window.localStorage.setItem("koharu-formatting-toolbar-visibility", "hidden");
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
  });

  expect(button("Show formatting toolbar", editorPane()).getAttribute("aria-expanded")).toBe("false");
  expect(editorPane().querySelector("#formatting-toolbar-region")).toBeNull();
});

it("renders the message area after the editor and localizes the toggle", async () => {
  const pane = editorPane();
  const editor = pane.querySelector(".markdown-editor");
  const messageArea = pane.querySelector(".editor-message-area");
  if (!editor || !messageArea) throw new Error("Editor layout regions not found");
  expect(editor.compareDocumentPosition(messageArea) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  expect(messageArea.querySelector(".formatting-feedback")).not.toBeNull();

  await click(button("View"));
  const viewMenu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
  const japaneseUi = viewMenu?.querySelector<HTMLInputElement>('input[name="language"][value="ja"]');
  if (!japaneseUi) throw new Error("Japanese UI choice not found");
  await click(japaneseUi);

  expect(button("書式バーを隠す", editorPane()).getAttribute("aria-expanded")).toBe("true");
});

it("keeps guidance at the bottom and the toggle available only with a visible editor pane", async () => {
  act(() => root.unmount());
  window.localStorage.removeItem("koharu-toolbar-hint-dismissed");
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
  });

  const pane = editorPane();
  expect(pane.querySelector(".editor-message-area .toolbar-hint")).not.toBeNull();
  expect(pane.querySelector(".formatting-toolbar-region .toolbar-hint")).toBeNull();

  const switcher = container.querySelector<HTMLElement>(".view-mode-switcher");
  if (!switcher) throw new Error("View mode switcher not found");
  await click(button("Split", switcher));
  expect(pane.hidden).toBe(false);
  expect(button("Hide formatting toolbar", pane)).not.toBeNull();

  await click(button("Preview", switcher));
  expect(pane.hidden).toBe(true);
  expect(pane.getAttribute("aria-hidden")).toBe("true");
});
```

- [ ] **Step 2: Run the integration tests and verify RED**

Run: `npm test -- src/App.documentSessionSafety.test.tsx`

Expected: FAIL because the header toggle and `.editor-message-area` are absent.

- [ ] **Step 3: Add localized labels and toolbar state to `App`**

Import the Task 1 functions:

```ts
import {
  readFormattingToolbarVisibility,
  writeFormattingToolbarVisibility,
} from "./formattingToolbarPreference";
```

Add text entries to both `UI_TEXT` branches:

```ts
// en
showFormattingToolbar: "Show formatting toolbar",
hideFormattingToolbar: "Hide formatting toolbar",

// ja
showFormattingToolbar: "書式バーを表示する",
hideFormattingToolbar: "書式バーを隠す",
```

Initialize state alongside the existing toolbar-hint state:

```ts
const [isFormattingToolbarVisible, setIsFormattingToolbarVisible] = useState(
  readFormattingToolbarVisibility,
);
```

Add the toggle callback near `dismissToolbarHint`:

```ts
const toggleFormattingToolbar = useCallback(() => {
  setIsFormattingToolbarVisible((visible) => {
    const nextVisible = !visible;
    writeFormattingToolbarVisibility(nextVisible);
    return nextVisible;
  });
}, []);
```

- [ ] **Step 4: Render the toggle, conditional toolbar, and bottom message area**

Inside `.pane-header`, after `.pane-title` and before the search UI, render:

```tsx
<button
  type="button"
  className="formatting-toolbar-toggle"
  aria-controls="formatting-toolbar-region"
  aria-expanded={isFormattingToolbarVisible}
  aria-label={isFormattingToolbarVisible ? text.hideFormattingToolbar : text.showFormattingToolbar}
  title={isFormattingToolbarVisible ? text.hideFormattingToolbar : text.showFormattingToolbar}
  onClick={toggleFormattingToolbar}
>
  <span aria-hidden="true">{isFormattingToolbarVisible ? "▴" : "▾"}</span>
  <span>{isFormattingToolbarVisible ? text.hideFormattingToolbar : text.showFormattingToolbar}</span>
</button>
```

Render only the toolbar in its controlled region:

```tsx
{isFormattingToolbarVisible && (
  <div id="formatting-toolbar-region" className="formatting-toolbar-region">
    <MarkdownToolbar
      language={appLanguage}
      disabled={isFormattingDisabled}
      disabledReason={isDocumentSafetyActive && editorMode !== "preview" ? "documentSafety" : undefined}
      formattingContext={formattingContext}
      onFormat={handleMarkdownFormat}
    />
  </div>
)}
```

After `MarkdownEditor`, render the messages. Feedback has priority; the hint appears only when there is no feedback:

```tsx
<div className="editor-message-area">
  {formattingAnnouncement.message ? (
    <FormattingFeedback announcement={formattingAnnouncement} />
  ) : isToolbarHintVisible ? (
    <aside className="toolbar-hint" aria-label={text.toolbarHintTitle}>
      <span>{text.toolbarHintBody}</span>
      <button type="button" onClick={dismissToolbarHint}>{text.dismiss}</button>
    </aside>
  ) : (
    <FormattingFeedback announcement={formattingAnnouncement} />
  )}
</div>
```

- [ ] **Step 5: Implement the compact grid and control styles covered by the failing layout contract**

Replace the editor grid rules and split the message styling from the toolbar styling:

```css
.editor-pane {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: visible;
}

.formatting-toolbar-region,
.editor-message-area {
  position: relative;
  min-width: 0;
}

.editor-message-area:empty {
  display: none;
}

.editor-message-area .toolbar-hint,
.editor-message-area .formatting-feedback:not(:empty) {
  border-top: 1px solid var(--border);
  border-bottom: 0;
}

.formatting-toolbar-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  min-height: 30px;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-bg);
  color: var(--text);
  font-size: var(--ui-font-size);
}

.formatting-toolbar-toggle:hover {
  background: var(--hover-bg);
}
```

Keep `.formatting-feedback:empty` visually hidden for its live-region semantics. At the existing narrow-screen media query, allow the text label to remain visible unless the header demonstrably overflows; if it overflows at the project's narrow test width, visually hide only the button's second `span` and retain the localized `aria-label`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- src/formattingToolbarPreference.test.ts src/App.documentSessionSafety.test.tsx src/components/FormattingFeedback.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the accessible behavior, DOM order, and layout**

```powershell
git add -- src/App.tsx src/App.documentSessionSafety.test.tsx src/styles.css
git commit -m "feat: add collapsible formatting toolbar"
```

---

### Task 3: Responsive Visual Review and Full Verification

**Files:**
- Verify: `src/App.tsx`, `src/styles.css`, and the focused tests from Tasks 1-2
- Verify: `src/buildInfo.ts` remains unchanged after generated-build checks

**Interfaces:**
- Consumes: the committed Task 1 preference API and Task 2 layout.
- Produces: fresh automated and visual evidence that the complete behavior meets the acceptance criteria.

- [ ] **Step 1: Run focused and full frontend verification**

Run:

```powershell
npm test -- src/formattingToolbarPreference.test.ts src/App.documentSessionSafety.test.tsx src/components/FormattingFeedback.test.tsx
npm test
npx tsc --noEmit
npm run build
```

Expected: all tests PASS, TypeScript exits 0, and Vite build exits 0. The existing large-chunk warning is acceptable; new errors or warnings are not.

- [ ] **Step 2: Restore generated build metadata if the build changed it**

Run: `git diff -- src/buildInfo.ts`

If the only difference is the generated build timestamp, restore the tracked value with an `apply_patch` edit. Do not use `git checkout`, `git restore`, or destructive reset commands.

- [ ] **Step 3: Perform desktop visual verification**

Start the app or the Vite frontend at the screenshot's approximate desktop width and verify:

1. The message appears below the editor, immediately above the global status bar.
2. The header toggle adds no row and remains readable in Japanese.
3. Hiding the toolbar expands the editor vertically.
4. Showing the toolbar restores the same controls.
5. Reloading preserves the hidden or visible choice.
6. Edit and Split layouts remain usable; Preview-only mode contains no editor toggle.
7. Empty message state contributes no visible bottom strip.

- [ ] **Step 4: Check the final committed diff**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors and only the planned files are modified.

- [ ] **Step 5: Re-run completion verification from the committed tree**

Run:

```powershell
npm test
npx tsc --noEmit
npm run build
git diff --check
git status --short
```

Expected: all test files pass with zero failures; TypeScript and build exit 0; `git diff --check` is silent; the worktree is clean.
