# Work Log

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
