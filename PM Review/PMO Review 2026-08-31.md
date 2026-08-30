# PMO Review 2026-08-31

## Review Type
Incremental Review

## Portfolio Status
Active

## Previous Review
2026-08-26

## Current State
Koharu remains the active stable product direction. A material UI/release-preparation change landed after the previous PMO snapshot, moving the application to version 1.2.5 and rebuilding the Microsoft Store MSIX.

## Changes Since Last Review
- Commit `469ac105` — `Unify UI typography and simplify search`.
- Version synchronized from 1.2.2 to 1.2.5 across npm, Cargo, Tauri, lockfile, and generated build metadata.
- Search was simplified from a nested menu to a direct top-level Search toggle with `Ctrl+F` / `Escape` behavior.
- Ordinary interface typography was standardized at a compact 13 px and invalid font shorthand fallbacks were corrected.
- Regression coverage was expanded for search interaction and computed interface typography.
- Work log records validation of 63 npm test files / 382 tests, successful Tauri release build, MakeAppx packaging, and an unsigned x64 `Koharu_1.2.5.0_x64.msix` with validated Store identity.
- No Issue/PR updates were detected in the review window.
- No new GitHub Release was observed; the latest listed GitHub Release remains Koharu v1.0.0 from 2026-07-27, so Store packaging and GitHub Release state are not synchronized.

## Previous Action Items
| Action | Status |
|---|---|
| Keep Koharu production scope explicit and isolate/label Hotaru-only modules | Unknown |
| Add/confirm release checklist for Store packaging, tests, signing, and versioning | In Progress — 1.2.5 build/test/package evidence exists; Store submission/acceptance still unconfirmed |
| Decide and document repository license if public distribution is intended | Not Started |

## Risks / Concerns
1. Partner Center submission/acceptance remains the operational release checkpoint; the Store MSIX is intentionally unsigned for upload.
2. GitHub Release state trails the application/Store package version, which can create release-source ambiguity.
3. Existing Vite large-chunk advisory remains.
4. Koharu/Hotaru scope boundaries and the public-distribution license decision remain open PMO items.

## Recommended Actions
1. Complete or confirm Partner Center submission/acceptance for Koharu 1.2.5.
2. Decide whether GitHub Releases should track Store versions; if yes, publish/update the release baseline consistently.
3. Resolve the public-distribution license decision and keep Koharu/Hotaru scope boundaries explicit.

## Portfolio Recommendation
**Keep Active.** Continued product and Store-release activity clearly supports Active status.

## Next Review Guidance
Prioritize Partner Center evidence, release/tag changes, packaging or file-association fixes, and regression results. Use No-change Review if no further material activity occurs.