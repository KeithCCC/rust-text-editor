---
name: build-koharu-msix
description: Use when packaging the Koharu Tauri desktop app as an x64 MSIX for Microsoft Store submission, validating Store package identity, or diagnosing MakeAppx and AppxManifest packaging failures.
---

# Build Koharu MSIX

## Overview

Build Koharu's release executable, stage a full-trust desktop package, generate Store-sized icon assets, and create an unsigned MSIX with the Windows SDK. Treat Partner Center identity values as immutable inputs.

## Workflow

1. Confirm the repository root contains `package.json`, `src-tauri/tauri.conf.json`, and `.git`.
2. Read `git status --short`; preserve unrelated user changes.
3. Reserve Koharu in Partner Center. Copy these values from **Product management > Product identity** exactly:
   - `Package/Identity/Name`
   - `Package/Identity/Publisher`
   - `Package/Properties/PublisherDisplayName`
4. Stop if any Store identity value is unknown. Never invent a production identity.
5. Check that `koharu.exe` is not running. Ask the user to close it; do not terminate it without approval.
6. Run the bundled script from the repository root:

```powershell
& .\.codex\skills\build-koharu-msix\scripts\build-koharu-msix.ps1 `
  -PackageIdentityName '<Partner Center Identity Name>' `
  -Publisher '<Partner Center Publisher>' `
  -PublisherDisplayName '<Partner Center Publisher Display Name>'
```

7. Report the output path, version, architecture, size, and SHA-256 hash.
8. Upload the `.msix` to Partner Center. Microsoft signs the package after certification; do not buy a certificate merely for the Store MSIX path.

## Script options

| Option | Use |
|---|---|
| `-SkipBuild` | Package an already-built `target/release/koharu.exe` |
| `-Version 1.0.0.0` | Override the Tauri version; use four numeric components |
| `-IconPath <png>` | Override the default 1024px Koharu icon |
| `-OutputPath <msix>` | Choose the artifact path |
| `-MakeAppxPath <exe>` | Select a specific Windows SDK tool |

The default artifact is `target/release/bundle/msix/Koharu_<version>_x64.msix`.

## Verification

- Run `.codex/skill-tests/build-koharu-msix.Tests.ps1` after changing the skill or script.
- Run the Windows App Certification Kit before Store submission when available.
- For local installation, sign the MSIX with a test certificate trusted on that machine. An unsigned Store-upload package is not locally installable.
- Add file-association manifest entries only after Koharu handles packaged activation safely.

## Common mistakes

- **Identity mismatch:** Recopy all three values from Partner Center; friendly names are not substitutes.
- **Invalid version:** Store MSIX versions use four integers; the first must be 1–65535, the middle components 0–65535, and the fourth component (revision) must be `0`.
- **Locked executable:** Close Koharu before rebuilding.
- **Missing MakeAppx:** Install the Windows 10/11 SDK and rerun.
- **MSI assumptions:** This is the Store-managed MSIX path, not the separately hosted MSI/EXE path.
