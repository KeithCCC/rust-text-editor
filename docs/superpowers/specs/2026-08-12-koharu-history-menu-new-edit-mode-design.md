# Koharu History Menu and New-Document Edit Mode Design

## Purpose

Keep the File menu compact when many recent documents exist, make long recent filenames readable without wrapping, and ensure a newly created blank document opens in the editing workspace.

## Scope

- Add a localized top-level History menu immediately after File.
- Move all recent-file entries, per-entry removal controls, and the clear-history action from File into History.
- Render every recent filename on one line and truncate overflow with an ellipsis.
- Expose each complete filename through a pointer hover tooltip.
- Switch to Edit mode after the New command successfully creates a blank document.
- Preserve the existing recent-file order, limit, storage, missing-file handling, and unsaved-document safeguard.

This change does not alter which files are stored in history, file-opening behavior, editor content, or the user's saved default mode.

## Menu Structure

The menubar order begins with File, History, View, Settings, Search, Format, and Help. File contains only document commands such as New, Open, Save, export, properties, and Exit.

History uses the existing top-level menu interaction: click to open or close, hover between menus while one is open, click outside to dismiss, and run an item to dismiss. It contains:

1. The current recent files in their existing most-recent-first order.
2. A remove button for each entry.
3. A separator and Clear Recent Files action when entries exist.
4. A disabled localized No Recent Files message when history is empty.

Removing or clearing history updates the existing persisted recent-file state. Trying to open a missing file continues to remove only that inaccessible entry.

## Recent Filename Presentation

Each recent-file row keeps a filename action and its adjacent remove action. The filename is a single line with a fixed maximum menu width, `white-space: nowrap`, hidden overflow, and `text-overflow: ellipsis`. The complete filename is assigned to the filename action's `title` attribute so pointer hover reveals it.

The path subtitle is removed. This keeps every history entry compact and prevents the menu from becoming excessively tall. The file-opening action still uses the stored full path internally.

The remove action retains its localized accessible name containing the complete filename. Its tooltip describes the removal action rather than duplicating the filename tooltip.

## New-Document Mode Behavior

The existing New command continues to request a safe document transition. If the current document has unsaved changes, the confirmation appears before any document or mode change.

After the user approves the transition and the blank document is created, the application sets the current editor mode to Edit. If the user cancels, the current document and mode remain unchanged. The same behavior applies whether New is invoked from the File menu or its existing keyboard shortcut because both routes use the same handler.

This mode change affects the active session only. It does not overwrite the persisted editor-mode preference, so startup behavior remains unchanged.

## Accessibility and Localization

- History, No Recent Files, and the existing history actions have English and Japanese labels.
- The top-level History button exposes its open state through `aria-expanded`, matching the other menus.
- Recent filenames remain real button text even when visually truncated.
- Complete filenames remain available to pointer users through native title tooltips and to assistive technology through the button text.
- Remove actions keep filename-specific accessible labels.

## Testing

Automated tests cover:

- History is a top-level menu and recent files no longer appear in File.
- History entries contain one filename line, the complete filename tooltip, and no path subtitle.
- Empty history shows the disabled localized empty message.
- Opening, removing, clearing, and missing-file cleanup retain their existing behavior.
- A successful New command switches Split or Preview mode to Edit.
- Canceling New because of unsaved changes preserves the current mode and document.
- English and Japanese menu labels render correctly.

Visual verification covers ellipsis behavior with a long filename, full-name hover text, bounded menu height, switching between File and History, and the empty-history state.

## Acceptance Criteria

- Recent files and Clear Recent Files exist only in a top-level History menu placed after File.
- File remains fully usable even when the recent-file list is at its maximum size.
- Recent filenames never wrap and show an ellipsis when wider than the menu.
- Hovering a recent filename exposes its complete filename.
- The History menu remains present and explains when no recent files exist.
- Creating a blank document switches to Edit only after the safe transition succeeds.
- Canceling the unsaved-changes prompt changes neither the document nor its mode.
- Existing recent-file persistence, ordering, removal, and missing-file handling continue to work.
