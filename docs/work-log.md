# Work Log

## 2026-07-27 09:12:00 +09:00 - master

### Summary

Prepared Koharu 1.0.0 for public release with system-aware startup language selection, visible Markdown soft line breaks, Windows release packaging support, and refreshed distribution assets.

### Notable Changes

- Promoted the npm, Cargo, Tauri, lockfile, and generated build metadata versions to 1.0.0.
- Added automatic Japanese startup selection for Japanese system locales while preserving saved language preferences, with focused unit tests.
- Made single newlines render as visible line breaks in Markdown preview and added regression coverage.
- Added and validated the Koharu MSIX packaging skill, contract tests, release artwork/screenshots, planning documents, and reusable skill-transfer exports.
- Rebuilt the portable executable, MSI, and NSIS setup package for the 1.0.0 GitHub release.
- Ignored generated `.superpowers/brainstorm` runtime state so local process and token files are not committed.

### Validation

- `npm test` passed: 38 test files and 168 tests.
- `.codex/skill-tests/build-koharu-msix.Tests.ps1` passed.
- `npm run build` passed.
- `npm run tauri build` passed and produced `koharu.exe`, `Koharu_1.0.0_x64_en-US.msi`, and `Koharu_1.0.0_x64-setup.exe`.

### Risks And Follow-Ups

- Vite still reports large Mermaid/Excalidraw-related chunks; this is an optimization warning rather than a release failure.
- A production Store MSIX still requires the exact immutable Partner Center package identity and publisher values.

## 2026-07-08 03:00:00 +09:00 - master

### Summary

Converted the desktop app into Koharu, a single-file Notepad-like Markdown editor, while preserving the vault implementation in a separate worktree for future Hotaru/Vault work.

### Notable Changes

- Renamed package, Tauri metadata, icon assets, and build output to Koharu.
- Removed the vault sidebar from the Koharu UI and disabled vault commands from the Tauri invoke handler.
- Reworked the main shell around single-file open/save/save-as/export/file-properties flows.
- Restored Japanese UI switching, changed Koharu's dark theme palette, and used `asset/koharu.png` for app icons.
- Fixed menu dismissal when clicking into the editor and made the native window close button exit cleanly through Koharu's close flow.
- Added tests for document title/default save path, menu dismissal, and close confirmation behavior.

### Validation

- `npm test` passed with 15 tests.
- `npm run build` passed.
- Rendered browser QA verified Japanese UI, dark theme, preview toggle visibility, and menu dismissal on editor click.
- Desktop smoke test launched `target/release/koharu.exe`, sent a normal window close request, and verified the process exited.
- `npm run tauri build` passed and rebuilt `target/release/koharu.exe`, MSI, and NSIS installers.

### Risks And Follow-Ups

- The Rust backend still contains unused vault helper functions for now, so release builds report dead-code warnings.
- GitHub release/download assets still need a release update if Koharu should be publicly downloadable from GitHub Releases.

## 2026-05-18 07:45:50 +09:00 - master

### Summary

Added in-editor text search to Hotaru, including keyboard shortcuts, match navigation, and visible selection of the active match.

### Notable Changes

- Added a search box to the editor header with live match counts and Prev/Next controls.
- Implemented case-insensitive matching against the current editor contents.
- Added Ctrl/Cmd+F focus behavior and F3/Shift+F3 navigation.
- Kept keyboard focus in the search field while typing, then selected and scrolled to the active match only when navigating.
- Styled the search controls to fit the existing pane header layout.

### Validation

- `npm run build` passed.
- `cargo check` passed.

### Risks And Follow-Ups

- The active match is highlighted via the textarea selection; highlighting all matches would require a richer editor layer or overlay.
- The release executable and installers were not rebuilt because `target/release/hotaru.exe` was running at the time of validation.

## 2026-05-17 19:37:00 +09:00 - master

### Summary

Fixed Hotaru's custom menu behavior so menu selections close immediately and users get clear feedback that an action was accepted.

### Notable Changes

- Replaced hover/focus-only menu display with React-managed active menu state.
- Closed the active menu before running menu item actions such as Save, Open, theme changes, and Format JSON.
- Added outside-click and Escape handling for dismissing open menus.
- Kept menu-to-menu hover switching while a menu is already open.
- Rebuilt the release executable and MSI/NSIS installers, then relaunched `target/release/hotaru.exe` for local testing.

### Validation

- `npm run build` passed.
- `cargo check` passed.
- `npm run tauri build` passed after closing the running `hotaru.exe` process.

### Risks And Follow-Ups

- Keyboard menu navigation is still basic; Escape is handled, but arrow-key navigation could be added later.
- Vite still reports large Mermaid/Excalidraw-related chunks; this remains a packaging warning, not a build failure.

## 2026-05-15 01:46:00 +09:00 - master

### Summary

Improved Hotaru's file open diagnostics and made the Open dialog default to a combined text, Markdown, and JSON filter.

### Notable Changes

- Switched file drop handling to the current Tauri window listener and kept the existing single-file drop behavior.
- Added debug log entries around drop listener setup, dropped paths, file open attempts, and file open results.
- Changed the Open dialog's primary filter to include `.txt`, `.md`, `.markdown`, and `.json` together.
- Rebuilt the release executable and MSI/NSIS installers, then uploaded the MSI to the GitHub `v0.1.0` release.

### Validation

- `npm run build` passed.
- `cargo check` passed.
- `npm run tauri build` passed after closing the running `hotaru.exe` process.

### Risks And Follow-Ups

- The extra drop/open debug logging is useful for diagnosing local file issues, but can be reduced later if the log gets noisy.
- Vite still reports large Mermaid/Excalidraw-related chunks; this remains a packaging warning, not a build failure.

## 2026-05-11 23:33:50 +09:00 - master

### Summary

Added support for opening a file passed by Windows file association. When a Markdown file launches Hotaru via association, the app now prioritizes that startup file over the previously remembered file.

### Notable Changes

- Added a native `get_startup_file_path` command that scans launch arguments for the first real file path.
- Exposed the startup file command to the React frontend through the Tauri wrapper.
- Updated startup document selection order to open the associated file first, then fall back to the last file, then create a new Vault note.
- Rebuilt the release executable at `target/release/hotaru.exe`.

### Validation

- `cargo check` passed.
- `npm run build` passed.
- `npm run tauri -- build` passed.

### Risks And Follow-Ups

- File association must pass the document path to Hotaru, typically equivalent to `hotaru.exe "%1"`.
- Vite still reports large Mermaid/Excalidraw-related chunks; this is a packaging warning, not a build failure.

## 2026-05-11 23:23:25 +09:00 - master

### Summary

Updated Hotaru's file handling and packaging path expectations. The app now builds as `hotaru.exe`, initializes a default Vault beside the running executable when none is configured, keeps Vault-backed notes autosaved, and opens dropped files directly from the desktop.

### Notable Changes

- Renamed the npm and Cargo package identities from `rust-text-editor` / `rust_text_editor` to `hotaru`, updating the native library entrypoint accordingly.
- Added native Vault commands that create or resolve `hotaru-valut`, including the default Vault path beside the running executable.
- Changed startup and new-note behavior to use the default Vault automatically, remember the last file, and display the active Vault path in the status bar.
- Added Tauri webview drag-and-drop handling for single-file drops, reusing the existing open-file path and showing a drop overlay during hover.
- Rebuilt release and debug outputs during verification, including `target/release/hotaru.exe`.

### Validation

- `cargo check` passed.
- `npm run build` passed.
- `npm run tauri -- build --debug` passed.
- `npm run tauri -- build` passed.

### Risks And Follow-Ups

- The Vault folder name is intentionally `hotaru-valut` per the latest request, including the spelling.
- Vite still reports large Mermaid/Excalidraw-related chunks; this is a packaging warning, not a build failure.

## 2026-05-10 23:37:20 +09:00 - master

### Summary

Finished the Hotaru desktop polish pass for production testing. The app now opens at a normal centered size, remembers window size and position after resize/move, exits cleanly from the File menu, uses the selected Hotaru firefly icon, and builds production installers without a console window.

### Notable Changes

- Added frontend window state persistence with restore-on-start and save-on-resize/move behavior.
- Added a Rust `exit_app` command for File > Exit and updated Tauri capabilities for window close support.
- Set the initial Tauri window to 1200x800 centered instead of maximized.
- Suppressed the Windows console window for production builds with the release Windows subsystem setting.
- Replaced the app icon with the selected Hotaru artwork crop and configured Tauri bundling to use it.
- Kept the original `asset/hotaru.png` source image and exported `src-tauri/icons/icon-source.png` for icon review.

### Validation

- `npm run tauri build` passed.
- Production executable rebuilt at `target/release/rust_text_editor.exe`.
- NSIS and MSI installers rebuilt under `target/release/bundle`.

### Risks And Follow-Ups

- Windows may cache old executable icons in Explorer until the cache refreshes.
- Vite still reports large Mermaid/Excalidraw-related chunks; this is a packaging warning, not a build failure.

## 2026-05-09 22:47:17 +09:00 - master

### Summary

Migrated the original Rust egui prototype into **Hotaru**, a Tauri v2 desktop app with a React and TypeScript frontend. The app now provides a Markdown-focused editor with optional preview, Mermaid rendering, Excalidraw file integration, theme support, resizable panes, debug logging, JSON formatting, and portable debug build support.

### Notable Changes

- Replaced the old single-file egui application with a Tauri workspace and Vite React frontend.
- Added native file commands for opening, saving, Excalidraw JSON reads/writes, and relative path resolution.
- Added Windows-style menus for file actions, theme selection, preview visibility, split reset, and JSON formatting.
- Added optional Markdown preview with Mermaid fenced-block rendering and `.excalidraw` embed cards/editing.
- Added system, light, and dark theme handling, with preview hidden by default and split-pane resizing.
- Added debug logging for Rust startup/panics, frontend startup, JavaScript errors, unhandled promise rejections, and React render failures, writing `debug.log` beside the running executable.
- Added JSON pretty formatting and syntax-colored JSON fenced blocks in Markdown preview.
- Renamed user-facing app branding to Hotaru.
- Added npm, Vite, TypeScript, Tauri, and Cargo workspace configuration for the new app structure.

### Validation

- `npm run build` passed.
- `cargo check` passed.
- Debug executable rebuilt with `cargo build --target-dir ..\target\debug-test`.
- Portable debug package refreshed under `target\portable-debug`.

### Risks And Follow-Ups

- The editor pane is still a plain textarea, so live editor syntax highlighting would require CodeMirror or Monaco.
- Vite reports large bundle chunks from Mermaid and Excalidraw; code-splitting can be improved later.
- The portable debug package still depends on Microsoft Edge WebView2 Runtime being installed on the target Windows PC.
