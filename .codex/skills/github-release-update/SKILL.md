---
name: github-release-update
description: Use when working in the Hotaru rust-text-editor repo and the user wants GitHub downloads, release assets, install files, installer downloads, or a GitHub Release updated from the latest local build.
---

# GitHub Release Update

## Overview

Publish Hotaru's latest release artifacts to GitHub so users can download the Windows install files from the GitHub Releases page.

This skill updates assets attached to an existing GitHub release tag, or creates the release when the tag exists but the release does not. It should normally be run after `full-build`, or run `full-build` first when artifacts may be stale.

Expected assets:

- `target/release/hotaru.exe`
- `target/release/bundle/msi/Hotaru_0.1.0_x64_en-US.msi`
- `target/release/bundle/nsis/Hotaru_0.1.0_x64-setup.exe`

## Workflow

1. Confirm the current directory is the repo root by checking `package.json`, `src-tauri/tauri.conf.json`, and `.git`.
2. Check `git status --short`.
   - If there are uncommitted source changes, tell the user the GitHub release will only match those changes after they are committed, pushed, tagged, and built.
   - Do not silently create a release tag on uncommitted work.
3. Confirm GitHub CLI is installed and authenticated:
   - `gh auth status`
4. Determine the release tag.
   - Use the tag requested by the user when provided.
   - Otherwise use the latest local tag matching `v*` with `git tag --sort=-creatordate`.
   - If there is no tag, stop and ask the user for the version tag to publish.
5. Confirm the tag exists locally and remotely:
   - `git rev-parse --short <tag>`
   - `git ls-remote --tags origin <tag>`
   - If the local tag is missing, stop.
   - If the remote tag is missing, push it only when the user has explicitly asked to publish that tag.
6. Run `full-build` unless the user explicitly says the existing artifacts are current.
7. Verify all expected assets exist and report their `LastWriteTime` and size.
8. Create the GitHub release if it does not exist:
   - `gh release view <tag> --repo KeithCCC/rust-text-editor`
   - If missing, run `gh release create <tag> --repo KeithCCC/rust-text-editor --title "Hotaru <tag>" --notes-file <notes-file>`
9. Upload or replace release assets using `--clobber`:

```powershell
gh release upload <tag> `
  target\release\hotaru.exe `
  target\release\bundle\msi\Hotaru_0.1.0_x64_en-US.msi `
  target\release\bundle\nsis\Hotaru_0.1.0_x64-setup.exe `
  --repo KeithCCC/rust-text-editor `
  --clobber
```

10. Verify the release and assets:

```powershell
gh release view <tag> --repo KeithCCC/rust-text-editor
```

Report the release URL and uploaded asset names.

## Notes

- Updating Git commits or pushing code does not update GitHub Release downloads by itself. The installer assets must be uploaded to the release.
- The current package version may still produce installer filenames containing `0.1.0` even when the Git tag is newer. Report this clearly if it occurs.
- If `hotaru.exe` is running, the full build may fail because the release executable is locked. Ask the user to close it or approve terminating the process before rebuilding.
- Use `--clobber` only when the user is updating existing release downloads.
