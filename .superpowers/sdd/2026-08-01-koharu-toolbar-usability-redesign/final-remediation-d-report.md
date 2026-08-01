# Final remediation D report — accessibility and focus behavior

## RED

- Added rendered `MarkdownToolbar` tests for an `aria-describedby` relationship, a single focusable localized disabled-status target, English Preview copy, Japanese document-safety copy, and no disabled command tab stops. The focused run failed because the status and relationship did not exist.
- Added rendered submenu tests for outside pointer, outside focus, unprevented Tab, and disabled/Preview dismissal. All four failed with `aria-expanded="true"`.
- Added a rendered `HelpDialog` harness. Initial focus/inert, Tab/Shift+Tab containment, programmatic outside-focus containment, Escape prevention/close, and invoker restoration all failed against the prior component.
- Removed the App wiring while adding real-App English Preview and Japanese pending-transition assertions; both failed with no described reason. Restoring the cause wiring made both pass.
- Existing server-rendered Help tests and TypeScript then caught two compatibility regressions (`document` during SSR and `Array.at` under ES2020); both were observed RED before correction.

## GREEN

- Focused interaction/App/SSR suite: 28/28 passed.
- Full suite: 40 files, 256/256 passed.
- TypeScript: `npx tsc --noEmit` passed.
- Production build: `npm run build` passed; generated `src/buildInfo.ts` was restored to its original values afterward.

## Focus model

- Disabled formatting keeps every native command disabled and at `tabIndex=-1`. One localized `role="status"` target is described by the toolbar and becomes visible when keyboard-focused.
- Help records the active invoker, marks background siblings inert, focuses the labelled header Close button, wraps Tab/Shift+Tab, redirects programmatic outside focus, closes on Escape, removes inertness, and restores the invoker.
- Toolbar submenus keep their roving Arrow/Home/End/Escape behavior. Outside pointer/focus and Tab close without trigger restoration; command selection and Escape still restore the trigger. Disabling/hiding for Preview closes any open submenu.

## Self-review and concerns

- Mutation check: removing the described-by/status, either locale/cause mapping, modal focus/inert/cleanup path, or any submenu dismissal path breaks a rendered behavior test.
- Existing responsive More and navigation tests remain green.
- Preview intentionally hides the editor pane and toolbar from accessibility traversal; its reason remains correctly wired for state consistency, while the focusable status is user-reachable during visible document-safety disabled states.
- Build completed with the pre-existing Vite large-chunk advisory; no runtime dependency or generated build metadata is included.
