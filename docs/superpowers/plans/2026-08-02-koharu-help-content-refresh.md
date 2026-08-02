# Koharu Help Content Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Koharu's in-app help and bilingual README so both accurately explain the current view modes, toolbar visibility, file-path location, and Find behavior.

**Architecture:** Keep the existing `HelpDialog` data model and rendering unchanged; revise only localized content and its static-render assertions. Extend the existing bilingual README in place with matching beginner guidance and no screenshots.

**Tech Stack:** React 19, TypeScript, Vitest, server-rendered component tests, Markdown.

## Global Constraints

- Preserve the existing help-dialog structure, Markdown examples, shortcut table, and Japanese/English parity.
- Do not change application behavior or add screenshots.
- Describe Edit, Split, and Preview using beginner-facing visible outcomes.
- State that toolbar visibility is remembered, the full path is in the bottom status bar, and Find from Preview exposes the visible search field in Split.
- Keep README English-first and Japanese-second; do not alter Hotaru positioning, development commands, or project structure.

---

### Task 1: Refresh the in-app help content

**Files:**
- Modify: `src/components/HelpDialog.tsx`
- Test: `src/components/HelpDialog.test.tsx`

**Interfaces:**
- Consumes: existing `HELP_CONTENT: Record<HelpLanguage, HelpContent>` and unchanged `HelpDialog` rendering.
- Produces: localized help paragraphs rendered through the existing `sections` array; no new exported API.

- [ ] **Step 1: Write failing Japanese and English content assertions**

Add assertions to the existing Japanese and English render tests for these user-visible facts:

```tsx
expect(html).toContain("編集・分割・プレビュー");
expect(html).toContain("表示・非表示");
expect(html).toContain("次回も引き継がれます");
expect(html).toContain("画面下部のステータスバー");
expect(html).toContain("自動的に分割表示");

expect(html).toContain("Edit, Split, and Preview");
expect(html).toContain("show or hide the formatting toolbar");
expect(html).toContain("remembered the next time you open Koharu");
expect(html).toContain("bottom status bar");
expect(html).toContain("automatically switches to Split");
```

Retain all existing assertions so the Markdown reference and dialog accessibility contract remain covered.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/components/HelpDialog.test.tsx
```

Expected: FAIL because the new guidance is not yet present.

- [ ] **Step 3: Replace the stale view and search guidance**

In both languages, replace the existing `Write and preview` / `文章を書く・プレビューする` section with two focused sections:

1. `Choose a view` / `表示を選ぶ`
   - Edit is editor-only.
   - Split shows editor and rendered result.
   - Preview is rendered-result-only.
2. `Toolbar, file path, and Find` / `ツールバー・ファイルパス・検索`
   - The editor-header control shows or hides the formatting toolbar and the choice is remembered.
   - The full current path is available in the bottom status bar.
   - `Ctrl+F` opens Find; from Preview, Koharu switches to Split and focuses the visible field.

Use the exact phrases asserted in Step 1. Do not modify the later Markdown basics, Text, Block, or Insert sections.

- [ ] **Step 4: Run focused HelpDialog tests and verify GREEN**

Run:

```powershell
npm test -- src/components/HelpDialog.test.tsx src/components/HelpDialog.interaction.test.tsx
```

Expected: both files pass with no unhandled errors.

- [ ] **Step 5: Commit the in-app help update**

```powershell
git add src/components/HelpDialog.tsx src/components/HelpDialog.test.tsx
git commit -m "docs: refresh in-app Koharu usage help"
```

### Task 2: Synchronize README usage guidance

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the user-visible behaviors documented by Task 1.
- Produces: matching English `Basic Usage` and Japanese `基本的な使い方` sections for repository readers.

- [ ] **Step 1: Correct the feature summaries**

In both feature lists:

- Replace the stale optional split-preview wording with Edit, Split, and Preview modes.
- Replace the narrow formatting-command wording with the current formatting toolbar groups for text, block, and insert actions.
- Mention remembered toolbar visibility and the full file path in the bottom status bar.

- [ ] **Step 2: Add matching basic-usage sections**

After each language's feature list, add four short numbered steps:

1. Create or open a Markdown/text file.
2. Select Edit, Split, or Preview based on the current task.
3. Show or hide the formatting toolbar; explain that the preference is remembered and the full path is at the bottom.
4. Use `Ctrl+F`; explain that Preview automatically changes to Split so the search field stays visible.

Keep the English and Japanese sections semantically equivalent and do not change the development instructions.

- [ ] **Step 3: Check bilingual coverage and stale wording**

Run:

```powershell
rg -n "Basic Usage|基本的な使い方|Edit, Split, and Preview|編集・分割・プレビュー|bottom status bar|画面下部|Ctrl\+F" README.md
rg -n "Optional split Markdown preview|任意で表示できる分割 Markdown プレビュー" README.md
git diff --check
```

Expected: the first command finds both languages; the stale wording command finds nothing; diff check is silent.

- [ ] **Step 4: Commit the README update**

```powershell
git add README.md
git commit -m "docs: update Koharu basic usage guide"
```

### Task 3: Final verification

**Files:**
- Verify: `src/components/HelpDialog.tsx`
- Verify: `src/components/HelpDialog.test.tsx`
- Verify: `README.md`

**Interfaces:**
- Consumes: completed Task 1 and Task 2 commits.
- Produces: release-ready documentation evidence; no file changes expected.

- [ ] **Step 1: Run all automated checks**

```powershell
npm test
npx tsc --noEmit
git diff --check
```

Expected: 41 test files and at least 285 tests pass; TypeScript and diff check are silent.

- [ ] **Step 2: Review localized parity and repository state**

```powershell
git status --short
git log -3 --oneline
```

Expected: clean status and two implementation commits above the plan commit. Confirm both languages describe the same four behaviors and no application code outside help content changed.
