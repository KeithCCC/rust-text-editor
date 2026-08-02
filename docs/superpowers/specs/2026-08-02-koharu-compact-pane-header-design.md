# Koharu Compact Pane Header Design

## Purpose

Reduce the editor and preview pane headers to approximately half their current height so more vertical space remains available for document content. Remove the duplicated file path from the editor header and keep the full path discoverable in the existing bottom status bar.

## Scope

- Remove the current file path or `Untitled` value from the editor pane header.
- Compact the normal editor and preview pane headers to approximately 24px.
- Compact the formatting-toolbar visibility button to fit the reduced header.
- Make the bottom status-bar path resilient to long paths while keeping the complete value available as a tooltip.
- Preserve Edit, Split, Preview, Japanese, English, keyboard, and accessibility behavior.

This change does not alter document titles, file operations, the formatting toolbar itself, preview rendering, or status values other than presentation of the file path.

## Header Layout

The editor header contains only:

1. The localized `Editor` label.
2. The formatting-toolbar visibility button.

The preview header continues to contain its localized pane label and the existing preview description. Both pane headers use the same normal height so their borders align in Split mode.

The normal target is a 24px minimum header height with minimal vertical padding. The toolbar visibility button uses a matching compact height and retains its existing label in Edit mode and icon-only treatment in Split mode.

When the in-document search interface is open, the header may grow to fit its controls. Compact height applies to the normal, non-search state; search usability takes priority over the 24px target.

## File Path Placement

The editor header no longer renders the file path. The complete path remains in the first item of the bottom status bar, which is already the established file-location display.

The status path item:

- Uses remaining horizontal space without pushing save state, preview state, statistics, or build information off-screen.
- Truncates visually with an ellipsis when space is limited.
- Exposes the complete localized `File: <path>` value through `title` so pointer users can inspect it.
- Keeps the same visible value when sufficient space exists.
- Displays the localized untitled value when the document has no path.

The application window title continues to show the filename, so removing the path from the pane header does not remove file identity from the top of the window.

## Accessibility

- The pane labels remain text, preserving the existing structural identification.
- The formatting-toolbar toggle retains its localized `aria-label`, `aria-expanded`, `aria-controls`, and keyboard behavior.
- The status-bar path remains real text rather than being available only through hover.
- Truncation is visual only; the complete value remains in the DOM and in the tooltip.

## Responsive Behavior

- Edit, Split, and Preview use aligned compact pane headers.
- Split mode keeps the existing icon-only toolbar toggle so the editor header does not wrap at the minimum supported pane width.
- Long paths shrink within the status bar instead of increasing its height or displacing later status items.
- The status bar remains a single line.

## Testing

Automated tests cover:

- The editor header no longer contains the current path or untitled text.
- The bottom status item contains the localized full path and matching tooltip.
- The bottom status item handles an untitled document.
- The toolbar toggle retains its accessible state and label after compaction.
- Editor and preview headers retain the expected structure in Edit, Split, and Preview.
- Long path presentation uses the dedicated shrinkable status class.

Visual verification covers normal desktop Edit, Split alignment, Preview, long paths, Japanese and English labels, and the expanded search-header exception.

## Acceptance Criteria

- The normal pane-header height is approximately 24px, about half the previous 44px height.
- The editor header does not display a file path or untitled value.
- The file path remains visible in the bottom status bar and is fully available through a tooltip.
- A long path does not wrap the status bar or hide the remaining status items.
- Editor and preview header borders align in Split mode.
- The toolbar visibility control remains usable by pointer, keyboard, and assistive technology.
- Existing Edit, Split, Preview, search, formatting, file, and status behavior continues to pass its tests.
