# Koharu Toolbar Usability and Editor-State Redesign

## Status

Approved for implementation on 2026-08-01 after independent reviews from a Markdown beginner perspective, an experienced engineer perspective, and a product/UI design perspective.

## Goal

Make Koharu's formatting features understandable without prior Markdown knowledge, predictable for experienced editor users, safe at arbitrary cursor positions, and accessible across keyboard, theme, and responsive layouts.

## Non-goals

- Replace CodeMirror with a WYSIWYG editor.
- Hide Markdown source from users.
- Add cloud services or external dependencies.
- Redesign unrelated document lifecycle or Excalidraw behavior.

## Considered Approaches

### A. Relabel the existing flat toolbar

Translate labels, add separators, and improve tooltips while leaving formatting commands unchanged.

- Advantage: smallest implementation cost.
- Disadvantage: unsafe block insertion, lost editor history, shortcut conflicts, and responsive splitter bugs remain.
- Decision: rejected because it improves appearance without making results reliable.

### B. Grouped toolbar backed by semantic formatting commands

Redesign the toolbar and the formatting engine together. Commands understand inline versus block semantics, preserve editor state, and expose localized metadata to both the toolbar and menu.

- Advantage: fixes usability and correctness at the same boundary; remains a source editor.
- Disadvantage: moderate implementation and regression-test cost.
- Decision: selected. It directly addresses every approved P1 finding without introducing a new editor model.

### C. WYSIWYG or hybrid rich-text editing

Render formatting directly in the editor and hide most Markdown syntax.

- Advantage: easiest mental model for beginners.
- Disadvantage: high complexity, changes Koharu's core identity, and creates new source-round-trip risks.
- Decision: rejected as outside this minor update.

## Information Architecture

The top application row continues to own global menus and the Edit / Split / Preview switcher. Formatting remains visually attached to the editor pane.

The toolbar is divided into three labelled and accessible groups:

1. Text
   - Heading level menu
   - Bold
   - Italic
   - Strikethrough
   - Link
   - Inline code
2. Block
   - Quote
   - Bullet list
   - Numbered list
   - Task list
   - Code block language menu: Plain text, Markdown, JavaScript, TypeScript, JSON, Rust, Bash, and PowerShell
3. Insert
   - Table
   - Mermaid diagram

At widths of 960px or less, Strikethrough, Table, and Mermaid move into an explicit More menu. Horizontal scrolling must not be the only way to discover actions.

Toolbar labels, accessible names, tooltips, placeholders, feedback messages, and menu commands use the active Koharu language. Standard icons use a consistent 16px visual system. Non-standard actions retain short visible labels.

## Command Behavior

### Shared rules

- Every toolbar operation is one CodeMirror transaction and one Undo step.
- Commands operate on all relevant selected lines, not arbitrary text fragments, when the target is a block construct.
- The document's existing LF or CRLF convention is preserved.
- A second invocation removes the same formatting when it is unambiguous.
- Read-only or document-safety states disable the toolbar visibly and expose the reason.
- Toolbar and Format-menu actions call the same command definitions and produce identical output.

### Inline formatting

Bold, italic, strikethrough, link, and inline code act on the current selection or insert a localized placeholder. Existing matching delimiters are removed on a second invocation.

Inline-code delimiters grow when the content contains backticks. Multiline selections direct users to Code Block instead of producing invalid inline Markdown.

Link insertion selects the URL field after a label is supplied. The toolbar and Format menu use the same URL placeholder and cursor behavior.

### Line and block formatting

Heading, quote, and list commands expand partial selections to complete lines. Existing heading/list/quote markers are replaced or removed instead of stacked. Heading exposes H1 through H6; the current heading level is reflected when detectable.

Code Block, Table, and Mermaid insertion guarantee valid block boundaries by adding only the necessary surrounding line breaks. Fence length grows if selected content already contains a triple-backtick fence. The Code Block menu supplies the selected language identifier or an empty identifier for Plain text.

Table never discards selected text. A selection containing at least two tab-separated columns per non-empty row is converted into a Markdown table. Every other selection is preserved, and a table template is inserted after the selected block at a safe boundary. The first editable header cell is selected after insertion.

Mermaid wraps a valid selection or inserts the existing starter diagram at a safe block boundary.

## Editor-State Preservation

Preview Mode must not destroy the CodeMirror editor instance. The editor remains mounted but hidden from layout and accessibility traversal. Returning to Edit or Split restores:

- Undo and redo history
- Primary selection and caret
- Editor scroll position
- Unsaved document content

The preview remains full width while the hidden editor consumes no visible space.

## Keyboard and Accessibility

- The existing Ctrl/Cmd+Shift+V mode-cycle shortcut is removed because it conflicts with paste-as-plain-text.
- Ctrl/Cmd+Alt+M cycles Edit, Split, and Preview. The handler ignores composing events and does not replace any native paste shortcut.
- Bold and italic keep standard Ctrl/Cmd+B and Ctrl/Cmd+I behavior.
- The toolbar uses roving tabindex with Left, Right, Home, and End navigation.
- Logical groups have localized accessible names.
- Toggle-capable commands expose `aria-pressed` when their active state is known.
- Commands expose `aria-keyshortcuts` where a real shortcut exists.
- Focus uses a shared, high-contrast 2px focus ring distinct from hover and selected states.
- Disabled safety-state controls use both visual disabled treatment and native/ARIA disabled semantics.

## Responsive Layout

Responsive behavior accounts for the outline width as well as the editor and preview minimum widths.

- Wide (more than 1100px): outline, editor, splitter, and preview may coexist.
- Medium (821–1100px): the outline is an overlay above the workspace when opened and does not reduce editor or preview width.
- Narrow: editor and preview stack vertically.
- The narrow splitter uses vertical pointer movement (`clientY`), Up/Down keys, and horizontal separator semantics.
- If a resizable narrow splitter is not reliable, the narrow layout uses a fixed proportion without a draggable separator.

Toolbar overflow uses an explicit More menu and remains fully keyboard reachable.

## Visual System

Define and use explicit tokens for:

- Soft accent background
- Selected foreground
- Focus ring
- Hover background
- Disabled foreground and surface

Spacing uses the existing product style with a consistent 4 / 8 / 12 / 16 / 24px scale. Toolbar controls target a 32–36px interaction height. Application menu, pane headers, and formatting toolbar use distinct but related surfaces so their hierarchy is visible.

Editor, preview, and outline headers share height, typography, close-button hit area, and supporting-text alignment. Light and dark themes keep the same brand-accent hue family and meet contrast requirements for focus and selection.

The currently undefined `--accent-soft` token is corrected before visual verification.

## Beginner Guidance

On first use, Koharu shows a dismissible, localized hint near the toolbar:

> Select text and choose a formatting button. Use Split to check the finished result.

The hint is stored locally and is not written into the Markdown document. Table, Code Block, and Mermaid template insertion always updates a non-blocking `aria-live` status message explaining what was inserted and which placeholder should be edited.

Help content documents every toolbar action with:

- Button name
- Intended use
- Inserted Markdown example
- Rendered-result explanation

The distinction between inline code and code blocks, regular and task lists, tables, and Mermaid diagrams is explicit. Help includes copyable examples but does not open or replace the current document with a sample.

## Components and Boundaries

- `markdownFormatting.ts`
  - Own semantic command definitions, line expansion, delimiter selection, toggle behavior, EOL preservation, and safe block insertion.
- `MarkdownEditor.tsx`
  - Apply command changes as CodeMirror transactions and preserve editor state while hidden.
- `MarkdownToolbar.tsx`
  - Render localized groups, menus, responsive overflow, roving focus, pressed state, disabled state, and tooltips.
- `App.tsx`
  - Supply language, safety state, viewport/split orientation, onboarding state, and shared commands to toolbar and menus.
- `styles.css`
  - Own tokens, hierarchy, focus, grouping, responsive outline behavior, and splitter orientation.
- `HelpDialog.tsx`
  - Explain toolbar actions and examples in Japanese and English.

Formatting logic remains independently testable without rendering React or CodeMirror.

## Feedback and Error Handling

- Silent no-op formatting is avoided. Disabled controls explain why they cannot run.
- A multiline inline-code request produces guidance instead of invalid Markdown.
- A table conversion that cannot infer rows preserves input and uses the safe template path.
- Onboarding and insertion feedback never block typing and can be dismissed.
- Existing document-safety and recovery behavior remains authoritative.

## Testing

### Formatting unit tests

- Empty, single-line, multiline, and partial-line selections
- LF and CRLF preservation
- Toggle on/off for inline and line formats
- Existing list, quote, and heading replacement
- Backticks and nested fences
- Safe document-start, middle, and end block insertion
- Table conversion and non-destructive fallback
- Cursor and selection placement

### Component tests

- Japanese and English labels, tooltips, placeholders, and Help content
- Group names, More menu, roving tabindex, key navigation, and disabled state
- Heading/list/code menus and accessible state
- Onboarding hint persistence and dismissal

### Integration and UI tests

- One-step Undo for every command
- Edit / Split / Preview transitions preserve history, selection, and scroll
- Native paste-as-plain-text is not intercepted
- Read-only safety state visibly disables formatting
- Wide, medium, and narrow layouts
- Horizontal and vertical splitter pointer/keyboard behavior
- Light, dark, system, Japanese, English, and 100–200% zoom
- Outline, search bar, long filename, and toolbar coexistence

### Regression and release verification

- Full Vitest and Rust suites
- Frontend production build
- Tauri release build
- Browser interaction smoke test
- Native smoke test for editor-state preservation and shortcut behavior

## Acceptance Criteria

- A beginner can distinguish inline code, code block, quote, task list, table, and Mermaid without knowing their source syntax.
- No formatting command silently deletes selected user text.
- Block commands produce valid standalone Markdown from any cursor position.
- Preview round trips retain Undo/Redo, selection, caret, scroll, and unsaved content.
- Standard paste-as-plain-text remains available.
- Toolbar and Format menu commands are behaviorally identical.
- Japanese UI contains no English-only formatting labels or placeholders; English UI remains complete.
- Keyboard users can traverse each toolbar group without thirteen Tab presses.
- The current mode, focus, hover, selected, and disabled states are visually distinct in both themes.
- Responsive editor, outline, preview, and splitter behavior matches their visual orientation.
