# Koharu Help Content Refresh Design

## Purpose

Update the in-app "How to use Koharu" dialog and the repository README so that both accurately explain the current Koharu interface after the next minor update. The revision should help first-time users understand the main view controls without turning either document into a long manual.

## Scope

Update these existing files:

- `src/components/HelpDialog.tsx`
- `src/components/HelpDialog.test.tsx`
- `README.md`

Do not change application behavior, add screenshots, or redesign the help dialog.

## In-app help

Preserve the current structure, Markdown examples, keyboard-shortcut table, and Japanese/English parity. Revise the introductory usage sections to explain:

- Edit shows the editor, Split shows the editor and rendered result, and Preview shows the rendered result.
- The formatting toolbar can be shown or hidden with the control in the editor header, and the preference is remembered.
- The current file path appears in the bottom status bar rather than the editor header.
- Find uses `Ctrl+F`; when invoked from Preview, Koharu switches to Split so that the visible search field can be used.

Keep the wording beginner-oriented and describe visible outcomes rather than implementation details.

## README

Keep the existing English-first, Japanese-second bilingual organization. Update the feature lists so they no longer describe preview as only an optional split preview. Add a short "Basic usage" / "基本的な使い方" section in both languages covering the same four behaviors as the in-app help.

The README remains both a product overview and a developer entry point. Existing Hotaru positioning, development commands, and project structure stay unchanged.

## Verification

Extend `HelpDialog.test.tsx` to assert the new Japanese and English guidance, including the three view modes, remembered toolbar visibility, bottom status-bar path, and Preview-to-Split Find behavior. Preserve the existing accessibility and interaction tests.

Run the focused HelpDialog tests, the complete test suite, TypeScript checking, and Markdown/source diff checks. Review the README and rendered help strings for Japanese/English consistency and stale descriptions.

## Success criteria

- Both help surfaces describe the current UI accurately.
- Japanese and English cover the same behaviors.
- Existing Markdown reference content remains available.
- No screenshots or application behavior changes are introduced.
- All automated checks pass.
