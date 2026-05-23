---
name: full-build
description: Use when working in the Hotaru rust-text-editor repo and the user asks for a full build, production build, release build, release exe, installer build, or verification that target/release/hotaru.exe is rebuilt.
---

# Full Build

## Overview

Run Hotaru's complete production build path: TypeScript/Vite frontend build plus Tauri release packaging. The expected release executable is `target/release/hotaru.exe`.

## Workflow

1. Confirm the current directory is the repo root by checking `package.json` and `src-tauri/tauri.conf.json`.
2. Check whether `target/release/hotaru.exe` is currently running. If it is running, stop and ask the user to close it or explicitly approve terminating it.
3. Run `npm run build` to verify the frontend and TypeScript compile independently.
4. Run `npm run tauri build` to build the release executable and installers. This command also invokes the frontend build through Tauri's `beforeBuildCommand`; keep the explicit `npm run build` first because it gives a faster, clearer frontend failure.
5. Verify `target/release/hotaru.exe` exists and report its `LastWriteTime` and size. Also report generated bundle paths under `target/release/bundle` when present.

## Commands

Use PowerShell from the repo root:

```powershell
npm run build
npm run tauri build
Get-Item target/release/hotaru.exe
Get-ChildItem target/release/bundle -Recurse -File
```

## Common Issues

- `hotaru.exe` may fail to rebuild if the running desktop app still has the executable locked. Do not kill the process without user approval.
- Vite may print chunk-size warnings for Mermaid or Excalidraw bundles. Treat those as warnings unless the command exits nonzero.
- If Tauri packaging succeeds, installers are expected under `target/release/bundle`.
