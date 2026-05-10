# Work Log

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
