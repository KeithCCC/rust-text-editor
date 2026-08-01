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

## Fix round 1

### RED

- Real-App Help close left focus on the now-hidden `How to use Koharu` menu item instead of the visible top-level Help trigger.
- Opening an unsaved decision while Help was active left both modal dialogs mounted and Help's focus containment won over the decision dialog.
- The decision-first path initially passed only because the document action gate happened to block the menu action. The test was strengthened to require explicit modal ownership by disabling the top-level Help trigger, and then failed RED.
- English and Japanese Preview tests found no focusable formatting-disabled status in the visible preview pane; the only status was under the hidden editor pane.

### GREEN

- The real-App document-session suite passes 16/16. It covers visible invoker restoration, both decision/Help orderings, one visible English Preview status, one visible Japanese Preview status, and the retained Japanese Edit/Split document-safety status.
- Focused real-App/component/SSR suite passes 41/41; standalone Help trap and toolbar submenu behavior remain green.
- Full suite passes 40 files and 260/260 tests; `npx tsc --noEmit` and `npm run build` pass.
- `src/buildInfo.ts` was restored after the build.

### Updated focus and ownership model

- App passes Help the stable top-level Help button as its restoration target; the transient menu item is never used for App-level restoration.
- A decision modal explicitly owns the top modal layer: Help controls are disabled/guarded, Help is not rendered concurrently, and an unsaved-decision request closes Help before DecisionDialog takes focus.
- Preview owns one visible, focusable localized status in the preview header. The hidden editor toolbar has no Preview status or description. In visible Edit/Split document-safety states, the toolbar retains its single described status target.

### Self-review

- Removing the stable invoker, either decision ownership gate, the Help-before-decision close, the visible status, either locale, or the hidden-toolbar suppression fails a real-App assertion.
- Existing Help Tab/Shift+Tab/Escape/inert tests and toolbar outside/focus/Tab/disabled dismissal tests remain unchanged and green.
- The production build retains only the pre-existing large-chunk advisory; no runtime dependency or generated metadata is included.
