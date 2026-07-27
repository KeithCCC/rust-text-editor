---
name: drive-drop
description: Use when the user asks to copy, upload, send, drop, replace, or update one or more local files in the fixed Google Drive 0.Drop folder.
---

# Drive Drop

Copy local files to the user's fixed Google Drive `0.Drop` folder while preserving their original file format.

**REQUIRED SUB-SKILL:** Use `google-drive:google-drive` for Google Drive operations.

## Fixed Destination

- Folder name: `0.Drop`
- Folder ID: `1SXLAoogVFkayYuzCeVibuL4YjyGu6Z2D`
- Folder URL: `https://drive.google.com/drive/folders/1SXLAoogVFkayYuzCeVibuL4YjyGu6Z2D`

Never substitute another folder with the same name.

## Workflow

For each supplied file:

1. Resolve the local path to an absolute path. Stop for that file if it does not exist or is not a file.
2. Open the fixed destination with `google_drive_list_folder`. Confirm it is accessible and named `0.Drop`.
3. List its direct children and compare names exactly, including extension and case.
4. Handle the result:
   - No match: upload with `google_drive_upload_file`, using the local path, original filename, and the fixed folder ID.
   - One match: replace its bytes with `google_drive_update_file(fileId, file_uri=...)`. Do not change its name, parents, or file ID.
   - Multiple matches: do not write. Show the matching IDs and links, then ask the user which file to replace.
5. Read the written file back with `google_drive_get_file_metadata`. Request `id,name,mimeType,size,parents,webViewLink,modifiedTime` and confirm its parent is the fixed folder.
6. Report whether the file was created or updated, plus its name, size, and Drive link.

Process multiple files independently. If one fails, continue with the others and report successes and failures separately. Do not roll back successful uploads.

## Safety Rules

- Preserve the source format; never convert files to Google Docs, Sheets, or Slides.
- Never delete files, change sharing, move files, or alter parent folders.
- Stop if the fixed folder is inaccessible or is not a folder.
- If post-write metadata cannot be read, report the write as unverified.
- If Google Drive tools are unavailable or disconnected, explain that the Google Drive plugin must be installed and connected.

## Quick Reference

| Existing exact-name matches | Action |
|---|---|
| 0 | Upload a new file |
| 1 | Update content while preserving ID and link |
| 2 or more | Stop and ask the user |

## Common Mistakes

- Searching all of Drive instead of checking the fixed folder's direct children.
- Uploading another copy when exactly one same-name file exists.
- Updating `name` or `parents` while replacing content.
- Claiming success without metadata verification.
