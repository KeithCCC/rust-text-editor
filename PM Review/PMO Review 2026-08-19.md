# PMO Review 2026-08-19

## Review Type
Incremental Review

## Portfolio Status
Active

## Previous Review
2026-08-18

## Current State
Koharu remains the active stable product direction in `rust-text-editor`, with Hotaru retained as the experimental knowledge-work line. Development is still active.

## Changes Since Last Review
A material commit was added after the previous review: `feat: prepare Koharu 1.2.0` (`a049102`). The change bumps the application from 1.1.0 to 1.2.0 across npm/Tauri metadata, adds the Tauri opener plugin/capability, wires external-link opening into the app/Markdown preview, updates generated capability schemas, adds preview interaction coverage, and refreshes build metadata. No open GitHub issues or open PRs were detected in the current scan.

## Previous Action Items
| Action | Status |
|---|---|
| Keep Koharu production scope explicit and isolate/label Hotaru-only modules | Unknown |
| Add/confirm release checklist for Store packaging, tests, signing, and versioning | In Progress |
| Decide and document repository license if public distribution is intended | Not Started |

## Risks / Concerns
1. The 1.2.0 release preparation adds external-link opening capability; this is expected functionality but increases the desktop permission surface and should be covered by release validation.
2. Koharu/Hotaru dual identity remains a product-scope maintenance risk.
3. Public repository still has no visible repository-level license metadata in the reviewed state.

## Recommended Actions
1. Validate the 1.2.0 release path, especially external-link handling, Tauri capability scope, packaging, and Store submission artifacts.
2. Confirm that the new Markdown-preview external-link behavior is limited to intended URL schemes and passes interaction tests in the packaged desktop build.
3. Resolve/document the public-distribution license decision.

## Portfolio Recommendation
**Keep Active.** The new 1.2.0 preparation commit confirms ongoing product development and release momentum.

## Next Review Guidance
Start from this review and inspect commits after `a049102`, release/tag/build evidence for 1.2.0, Store milestone progress, issue/PR state, and any permission/security changes.