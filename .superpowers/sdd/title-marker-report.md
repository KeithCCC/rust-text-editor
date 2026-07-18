# Native Windows dirty-title marker

## Root cause

`src/App.tsx` only assigned the formatted document title to `document.title`. That updates the webview document, but it does not update the native Windows title bar. The existing `formatDocumentTitle` implementation already returned the expected dirty title (for example, `*todo.md - Koharu`).

## Change

- Added `src/documentTitleSync.ts`, a narrow synchronization boundary that always updates `document.title` and, when supplied, awaits the same title through an injected native title setter.
- Native title failures are caught and reported with `console.error`, so the fire-and-forget call from the React effect cannot produce an unhandled rejection.
- Updated App's title effect to provide `getCurrentWindow().setTitle` only while `isTauriRuntime()` is true. The effect remains dependent only on `currentFile` and `modified`.
- Added `src/documentTitleSync.test.ts` for clean and dirty forwarding, plus native setter rejection handling.

## TDD evidence

1. RED: `npm test -- src/documentTitleSync.test.ts` failed before implementation because `./documentTitleSync` did not exist (`Cannot find module './documentTitleSync'`).
2. GREEN: the same focused command passed after the minimal boundary and App wiring were added: 1 file, 3 tests passed.

## Verification

- `npm test -- src/documentTitleSync.test.ts` — 1 file, 3 tests passed.
- `npm test` — 15 files, 61 tests passed.
- `npm run build` — passed (`tsc` and Vite production build). Existing chunk-size warnings remained.
- `cargo test` — 6 Rust tests passed.
- `cargo check` — passed.
- `git diff --check` — passed.
- Title-related source search confirmed `formatDocumentTitle`, `synchronizeDocumentTitle`, `document.title`, and the Tauri `setTitle` call are present in the intended locations.

## Self-review

The browser and native surfaces receive one identical, preformatted title. Browser-only development does not invoke Tauri APIs. The native asynchronous path is contained inside the boundary, including synchronous or asynchronous setter failures. No unrelated effect dependencies were added.

## Concerns

No manual UI validation was performed by design; the controller should verify the native Windows title bar. Pre-existing unstaged `src-tauri/Cargo.toml`, generated schema files, and `src/buildInfo.ts` were left out of this change; the build-generated build-info timestamp was restored to its prior unstaged value.
