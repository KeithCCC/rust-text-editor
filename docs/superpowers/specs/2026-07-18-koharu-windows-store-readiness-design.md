# Koharu Windows Store Readiness Design

## Purpose

Prepare Koharu for a trustworthy 1.0.0 release through Microsoft Store as a free, local-first Markdown editor published under the Daily AI Lab brand. The release uses an x64 MSI submitted through the Store's unpackaged Win32 path.

The work is organized into release-blocker phases so that document safety and accessibility are validated before distribution infrastructure is finalized.

## Product decisions

- The public product name is **Koharu**. Hotaru remains an experimental sibling and is not part of this Store release.
- The publisher brand is **Daily AI Lab**.
- Authenticode signatures use the publisher's verified legal name because Daily AI Lab is a personal-project brand rather than a registered organization.
- The dandelion artwork is the canonical product identity. App, installer, and Store assets derive from it.
- Development versions remain `0.x`. The first certified Store release is `1.0.0`.
- The first Store package supports Windows x64 only.
- Koharu remains free, local-first, and telemetry-free.

## Scope

### Included

- Product identity and release metadata cleanup.
- Safe document lifecycle, atomic writes, and crash recovery.
- First-run welcome experience and recent files.
- Keyboard, screen-reader, scaling, contrast, touch-target, and localization improvements.
- About, diagnostics, local-data, privacy, and update experiences.
- Markdown preview hardening.
- `.md` and `.markdown` Windows file associations.
- Signed x64 MSI production and Store submission readiness.
- A signed 0.9.0 release-candidate usability and accessibility round.

### Not included in 1.0.0

- Hotaru vault, backlink, tag, or notebook workflows.
- ARM64 packaging.
- Multiple-document tabs or multiple-file drag and drop.
- Telemetry or automatic crash uploads.
- Store MSIX packaging.
- File associations for `.txt`, `.json`, `.csv`, or `.log`.

## Delivery phases

### Phase 1: Identity and document safety

1. Align package, executable, installer, window, Help, README, and release metadata on Koharu and Daily AI Lab.
2. Replace both native close-request handlers with one document lifecycle coordinator.
3. Replace browser confirmations with a shared Save / Don't Save / Cancel workflow.
4. Implement atomic Markdown and Excalidraw writes.
5. Implement private recovery drafts and next-launch recovery.

### Phase 2: Core usability and accessibility

1. Add the welcome screen, recent files, and beginner actions.
2. Add the Edit menu and complete menu keyboard behavior.
3. Migrate modal experiences to one accessible dialog component.
4. Improve editor and preview semantics, focus visibility, touch targets, reduced motion, and responsive splitter behavior.
5. Complete Windows-language detection and Japanese/English accessibility localization.

### Phase 3: Trust and platform integration

1. Add About Koharu and Local data settings.
2. Move bounded logs and recovery data into the app-data directory.
3. Harden preview links, remote content, raw HTML, and Content Security Policy.
4. Add `.md` and `.markdown` associations and safe activation behavior.
5. Add privacy-preserving update checks and visible update controls.
6. Restore window state safely across monitor and DPI changes.

### Phase 4: Distribution readiness

1. Produce and validate the x64 MSI lifecycle.
2. Obtain personal code signing and integrate release signing.
3. Establish immutable installer hosting and Store metadata.
4. Produce the dandelion-based Store asset family.
5. Publish the required privacy and support destinations.

### Phase 5: Release validation

1. Publish a signed 0.9.0 release candidate through GitHub Releases.
2. Run low-skill, mid-skill, and engineering/accessibility usability reviews.
3. Resolve all release-blocking findings.
4. Promote the tested result to 1.0.0 and submit it to Partner Center.

## Document lifecycle architecture

### Coordinator

A single document lifecycle coordinator owns every operation that can replace or close the active document:

- New
- Open
- drag and drop
- relative Markdown-link navigation
- File > Exit
- title-bar close and Alt+F4
- update installation

No component or event listener may independently discard a modified document.

### Unsaved-change decision

The coordinator requests one of three explicit outcomes from the shared dialog:

- **Save**: persist the document and continue only after success.
- **Don't Save**: discard the current changes and continue.
- **Cancel**: stop the pending operation and leave the document unchanged.

Cancel is the safe default. Escape maps to Cancel. The dialog names the affected file when one exists.

### Atomic writes

The Rust backend exposes atomic write commands for Markdown and Excalidraw data:

1. Create a temporary sibling file.
2. Write all content and flush it.
3. Replace the destination atomically where Windows supports it.
4. Preserve the original file and report an actionable error if replacement fails.
5. Remove abandoned temporary files safely.

The UI reports success only after the backend confirms persistence.

### Recovery drafts

Koharu stores a private draft after editing becomes idle and refreshes it periodically while unsaved changes continue. The draft contains the content, original path when present, a document identity, and timestamps needed to decide whether recovery is valid.

On the next launch, a valid newer draft produces a Recover / Discard choice. Successful saving or explicit discard deletes the corresponding draft. Recovery never silently overwrites the original file.

Recovery drafts live in the Koharu app-data directory and are never uploaded.

## Welcome and recent files

When no document is active, Koharu displays a welcome screen with:

- New document
- Open a file
- a one-sentence Markdown explanation
- up to five recent files

Recent-file storage contains local paths only, never document contents. Missing files are removed automatically. Clear recent files is available both on the welcome screen and in Local data settings.

After the user opens or creates a document, Koharu displays the normal editor workspace. Keyboard shortcuts remain active from the welcome screen.

## Menus and dialogs

### Menu bar

The existing visual menu bar remains. It implements a complete desktop keyboard model:

- focus on open
- Left/Right movement between top-level menus
- Up/Down movement within menus
- Home/End and type-ahead where appropriate
- Escape closing the menu and returning focus to its trigger
- visible focus in normal and Windows forced-colors modes

The new Edit menu exposes Undo, Redo, Cut, Copy, Paste, and Select All with their shortcuts. Menu roles and native focusable elements must not conflict.

### Shared dialog component

Help, Appearance, File Properties, About, recovery, unsaved changes, and other modal experiences use one shared dialog component. It provides:

- an accessible name and description
- initial focus
- Tab and Shift+Tab containment
- inert background content
- safe Escape behavior
- focus restoration to the invoking control
- localized actions and screen-reader text

## Accessibility and responsive behavior

- Editor and preview are labelled regions with semantic headings.
- The CodeMirror editor has a localized accessible name.
- Consequential save, recovery, and update changes use restrained status announcements; character counts do not announce on every keystroke.
- Focus indicators remain visible in light, dark, system, and forced-colors modes.
- Small controls receive approximately 40-44 pixel hit areas where practical without visually enlarging every icon.
- Motion honors `prefers-reduced-motion`.
- When panes stack at narrow widths or high scaling, separator orientation, sizing, ARIA, and arrow keys change together.
- The mandatory validation matrix covers keyboard-only use, Narrator, forced colors, 200% and 400% scaling, English, and Japanese.

## Language behavior

On first launch, Koharu reads the Windows display language:

- Japanese Windows selects Japanese.
- Every other language selects English.

A manual selection is persisted and takes precedence on later launches. Changing language updates visible UI, accessible labels, and the document language metadata used by assistive technology.

## File presentation and feedback

- The filename is the primary identity shown in the editor header and status bar.
- The full path is available through a tooltip and File Properties.
- Successful saving briefly reports `Saved to <filename>` while retaining the Saved/Unsaved indicator.
- Errors remain visible until dismissed or resolved.
- Drag and drop accepts one supported file. Multiple or unsupported files produce clear feedback instead of silent partial handling.

## Privacy and protected preview

- Koharu collects no telemetry and uploads no crash reports automatically.
- External Markdown links open in the system browser.
- Remote images are blocked by default and require an explicit Load remote content action.
- Raw HTML is sanitized before preview rendering.
- The WebView uses a restrictive Content Security Policy compatible with bundled editor features.
- Help and the privacy statement explain local storage and remote-content behavior.

The privacy page must state that preferences, recent paths, recovery drafts, and logs remain local; update checks transmit only the minimal version and platform information needed to select an update.

## Diagnostics and local data

Logs live in the platform app-data directory, rotate within a fixed size budget, and exclude document contents by default. Fatal errors offer:

- Restart Koharu
- Copy diagnostic details
- Open log folder
- Contact support

Settings includes a Local data section with:

- Clear recent files
- Delete recovery drafts
- Clear logs
- Open Koharu data folder
- a plain-language explanation of on-device storage

## About Koharu

About Koharu displays:

- product version and build
- Daily AI Lab brand
- verified legal Authenticode signer
- copyright and license
- privacy link
- support link
- GitHub Releases link
- Copy diagnostics
- Open logs
- Check for updates

The support and privacy URLs are external release dependencies. Store submission is blocked until valid HTTPS destinations are configured. GitHub Issues remains a development support channel; the final public support-channel policy remains an explicitly tracked release issue, and a private contact method is mandatory.

## Windows integration

- Register `.md` and `.markdown` associations only.
- Validate double-click activation when Koharu is closed.
- When Koharu is open with unsaved changes, file activation passes through the document lifecycle coordinator.
- Restore normal window bounds and maximized state.
- Clamp restored bounds to an active monitor after monitor or DPI changes.

## Updates

Koharu checks for updates silently at startup only when at least 24 hours have elapsed since the last successful check. Offline failures remain silent. The request contains no document names, paths, or usage data.

When an update exists, Koharu shows release notes once and offers Update or Remind me later. The user explicitly approves download and installation. Update installation passes through the document lifecycle coordinator and cannot continue while unsaved changes are unresolved.

The update manifest carries a detached release signature verified by a public key embedded in Koharu. Before launching a downloaded MSI, Koharu verifies its declared checksum, valid Authenticode signature, and expected legal signer identity. GitHub Releases is the official release-notes destination and the temporary development download location. A Daily AI Lab download page and immutable direct MSI URL are required before Store submission.

## MSI and signing

The Store submission uses a complete x64 MSI through the unpackaged Win32 path. The installer supports silent installation as required by Partner Center; UAC may appear. It is not a downloader stub.

The release process must validate clean install, update, repair, and uninstall on a fresh Windows account.

### Code-signing prerequisite

Before Store submission:

1. Purchase Certum Standard Code Signing in the Cloud for the individual legal publisher.
2. Complete Certum's identity and residency verification.
3. Configure protected release-only access to the cloud-backed signing key.
4. Authenticode-sign and RFC 3161 timestamp every shipped `.exe` and `.dll`.
5. Sign and timestamp the completed MSI.
6. Verify every signature and certificate chain with Windows SignTool.
7. Install and uninstall the signed MSI on a clean Windows system.

The expected recurring certificate budget starts around EUR 209 per year and remains subject to provider pricing, tax, and exchange rates.

## Store assets and hosting

The dandelion source produces a consistent family for application icons, installer identity, Partner Center artwork, and screenshots. Small sizes require manual inspection for legibility.

Each Store submission references a versioned HTTPS direct MSI URL whose binary never changes. Development uses versioned GitHub Release assets. Before submission, Daily AI Lab must provide a reliable download page and direct installer URL; every later release receives a new URL.

## Testing strategy

### Automated

- Document lifecycle decisions for every initiating action.
- Single close listener and single prompt behavior.
- Atomic write success and failure handling.
- Recovery freshness, save cleanup, explicit discard, and stale-draft handling.
- Menu keyboard navigation and focus restoration.
- Dialog initial focus, containment, Escape, and restoration.
- Editor naming and localized accessibility metadata.
- Responsive separator orientation and key behavior.
- Remote-content blocking, HTML sanitization, and external-link routing.
- Update interval, offline handling, signature rejection, and unsaved-change coordination.
- Window-bound clamping and language selection.

### Manual Windows matrix

- Keyboard-only and Narrator workflows.
- Forced colors, light, dark, and system themes.
- 200% and 400% display scaling.
- English and Japanese UI and pronunciation.
- Mouse, touch, drag and drop, and file associations.
- Clean silent install, update, repair, uninstall, and restart.
- Crash recovery and interrupted save scenarios.
- Offline editing and protected remote-content behavior.

### Persona review

The signed 0.9.0 release candidate is reviewed by:

1. A low AI/IT-skill everyday Windows user.
2. A moderately technical Windows and Markdown user.
3. A software engineer performing an accessibility-focused review.

Release-blocking findings are fixed and retested before the candidate can become 1.0.0.

## Release gates

Koharu 1.0.0 cannot enter Partner Center certification until all of the following are true:

- Identity and metadata are consistent.
- Document safety and recovery tests pass.
- Accessibility matrix passes without blocked core workflows.
- Preview hardening and privacy behavior are verified.
- Valid support and privacy HTTPS destinations exist.
- The public support-channel release issue is resolved and a private contact method exists.
- Every shipped PE file and the MSI have valid timestamped signatures.
- The immutable MSI URL is live and reliable.
- Silent MSI lifecycle tests pass on a clean machine.
- The signed 0.9.0 persona review has no unresolved release blockers.

## Current official distribution references

- [Microsoft Store Win32 distribution options](https://learn.microsoft.com/en-us/windows/apps/distribute-through-store/how-to-distribute-your-win32-app-through-microsoft-store)
- [MSI/EXE app package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
- [Windows code-signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Choosing a Windows distribution path](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path)
