# Koharu Collapsible Formatting Toolbar Design

## Purpose

Increase the editor's usable vertical space without removing formatting guidance. The formatting toolbar becomes collapsible, and formatting feedback moves from the top of the editor to a compact message area at the bottom.

## Scope

- Add a formatting-toolbar visibility control to the editor pane header.
- Persist the user's visibility choice across application restarts.
- Move formatting feedback and the first-use toolbar hint below the editor content.
- Preserve behavior in Edit and Split modes, both supported UI languages, keyboard navigation, and document-safety states.

This change does not alter Markdown formatting commands, the global status bar, Preview-only layout, or editor content persistence.

## Layout

The editor pane uses four logical rows when the formatting toolbar is visible:

1. Editor pane header
2. Formatting toolbar
3. Editor content
4. Editor message area

When the toolbar is hidden, its row is removed and the editor content expands into the released space. The message area remains immediately below the editor content and immediately above the application's global status bar.

The editor message area contains, in priority order:

1. Formatting feedback, such as confirmation that a Mermaid block was inserted.
2. The dismissible first-use toolbar hint when no formatting feedback is present.

An empty message area consumes no visible height. Existing polite live-region behavior is retained so that formatting feedback remains available to assistive technology.

## Toolbar Visibility Control

A compact button appears at the right side of the existing editor pane header. It does not add another horizontal row.

- Visible toolbar: the button action is `Hide formatting toolbar`.
- Hidden toolbar: the button action is `Show formatting toolbar`.
- The button exposes its state through `aria-expanded` and references the toolbar region through `aria-controls`.
- Japanese and English labels follow the selected application language.
- The control is available whenever the editor pane is visible, including Split mode.
- Preview-only mode keeps the editor pane and its control hidden, matching the existing layout.

The toolbar is visible by default when no saved preference exists.

## Persistence

The visibility choice is stored in `localStorage` under a Koharu-specific key. App startup reads this preference once and restores the last explicit choice.

Only the two recognized values are accepted. Missing or invalid data falls back to visible, ensuring that corrupted browser storage cannot permanently hide the toolbar.

## Component and State Changes

`App` owns the saved visibility state because it coordinates the pane header, toolbar region, and editor layout. A small formatting-toolbar preference module owns the storage key and safe read/write behavior so that persistence can be tested independently.

The current formatting toolbar region remains the accessible control target. Rendering is conditional on the saved visibility state; hiding the toolbar does not reset formatting context, content, first-use guidance, or formatting announcements.

The message area is a separate sibling after `MarkdownEditor`, rather than part of the toolbar region. This DOM order makes the visual order and screen-reader reading order agree.

## Error Handling

Storage reads and writes are best-effort. If `localStorage` is unavailable or throws, Koharu continues with an in-memory visible/default state and the toolbar remains usable for the current session. No error banner is shown for a preference-only failure.

## Testing

Automated tests cover:

- Default toolbar visibility when no preference exists.
- Hiding and showing the toolbar from the pane-header button.
- Accessible state and labels in Japanese and English.
- Saving a visibility change and restoring it in a new app mount.
- Falling back to visible for invalid or unavailable storage.
- DOM order: toolbar before editor, message area after editor.
- Formatting feedback and first-use hint rendering in the bottom message area.
- Edit and Split mode behavior without changing Preview-only behavior.

Final verification includes the focused tests, the full frontend suite, TypeScript/build checks, and visual inspection at the desktop window size shown in the request.

## Acceptance Criteria

- Users can hide or show the formatting toolbar without opening a menu.
- The selected toolbar visibility survives an application restart.
- Hiding the toolbar increases the editor content's vertical space.
- Formatting feedback appears at the bottom of the editor pane, above the global status bar.
- The first-use hint no longer occupies space beneath the top toolbar.
- Empty feedback/hint state adds no visible bottom row.
- Keyboard and assistive-technology users can identify and operate the toggle.
- Existing formatting, preview, split-view, and document-safety behavior continues to pass its tests.
