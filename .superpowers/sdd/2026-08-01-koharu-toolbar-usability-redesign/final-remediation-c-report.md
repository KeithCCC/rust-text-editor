# Final remediation C report

## Status

Implemented outline/Preview heading correspondence by source-derived ID and corrected CommonMark ATX closing-hash handling.

## RED evidence

- `npm test -- src/markdownOutline.test.ts src/components/MarkdownPreview.test.tsx`
  - Failed 4 expected assertions: outline entries had index/no ID, Preview ATX headings had no IDs, duplicate headings were not addressable, and `# C#` parsed as `C`.
- Navigation mutation check: temporarily replaced the final ID lookup with the former rendered-heading-order behavior and ran `npm test -- src/App.outlineNavigation.test.tsx`.
  - Failed as intended: the two duplicate outline entries scrolled headings with empty IDs (the preceding Setext/raw targets) instead of `markdown-heading-30` and `markdown-heading-38`.

## GREEN evidence

- Focused: `npm test -- src/App.outlineNavigation.test.tsx src/markdownOutline.test.ts src/components/MarkdownPreview.test.tsx src/components/OutlinePanel.test.tsx` — 4 files, 9 tests passed.
- Full: `npm test` — 39 files, 243 tests passed.
- TypeScript: `npx tsc --noEmit` — passed.
- Production frontend: `npm run build` — passed; 2,714 modules transformed. The generated `src/buildInfo.ts` timestamp was restored afterward.

## Design

- `parseMarkdownOutline` now assigns `markdown-heading-{sourceOffset}` IDs and no longer exposes the rendered-heading index.
- Preview builds an offset-to-ID map from the same ATX outline parse. Its h1-h6 renderers use `node.position.start.offset`, confirmed to remain the original Markdown offset through `react-markdown` and `rehype-raw`, to assign IDs only to matching ATX headings. Setext headings remain untagged and raw HTML heading IDs remain intact.
- App outline selection queries the Preview by the outline entry ID. Duplicate visible text is therefore unambiguous, and a missing DOM target remains a safe no-op. Source-mode selection still uses the existing source offset.
- Closing hashes are removed only when a whitespace-delimited hash run ends the ATX line. Thus `# C#` stays `C#`, while `# Heading ###` becomes `Heading`.

## Coverage and concerns

- Tests cover preceding Setext and raw HTML headings, duplicate ATX text, missing target safety, valid closing hashes, `C#`, LF offsets, CRLF offsets, and direct CRLF Preview position correspondence.
- No dependencies were added. No toolbar, Help, accessibility, nesting, or keyboard behavior was changed.
- Vite retains its existing large-chunk warnings for Mermaid/Excalidraw bundles; the build exits successfully.
