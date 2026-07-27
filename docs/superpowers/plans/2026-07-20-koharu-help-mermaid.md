# Koharu Help Mermaid Syntax Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a copyable Mermaid syntax example to Koharu Help in both English and Japanese.

**Architecture:** Extend the existing locale-owned `HelpSection` data with one optional multiline code example and render it semantically inside the existing Help dialog. Keep all copy in `HELP_CONTENT`, preserve the current responsive card layout, and cover each locale independently in the server-rendered component tests.

**Tech Stack:** React 19, TypeScript, Vitest, React DOM server rendering, CSS

## Global Constraints

- Add Mermaid documentation only; do not add Excalidraw or other advanced-feature documentation.
- Provide localized headings and explanations in both English and Japanese.
- Show the exact fenced `flowchart LR` example approved in the design.
- Render the example with `pre` and `code` elements so whitespace remains visible and copyable.
- Follow test-driven development: observe the bilingual assertions fail before changing production code.

---

## File Structure

- Modify `src/components/HelpDialog.test.tsx`: independently assert English and Japanese Mermaid Help content and the fenced source.
- Modify `src/components/HelpDialog.tsx`: store localized Mermaid content, accept an optional multiline code example, and render it semantically.
- Modify `src/styles.css`: style the Help code block and keep content-heavy Help cards full-width.

### Task 1: Add bilingual Mermaid Help content

**Files:**
- Modify: `src/components/HelpDialog.test.tsx`
- Modify: `src/components/HelpDialog.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `HelpDialog({ language, onClose }: HelpDialogProps)` and the existing `HELP_CONTENT` locale map.
- Produces: `HelpSection.codeExample?: string`, localized Mermaid sections, and `.help-code-example` rendering.

- [ ] **Step 1: Write failing English and Japanese tests**

Add these assertions to their respective existing locale tests in `src/components/HelpDialog.test.tsx`:

```tsx
// Japanese locale test
expect(html).toContain("Mermaid図");
expect(html).toContain("コードブロック");
expect(html).toContain('class="help-code-example"');
expect(html).toContain("```mermaid\nflowchart LR\n  A[Start] --&gt; B[Finish]\n```");

// English locale test
expect(html).toContain("Mermaid diagrams");
expect(html).toContain("fenced code block");
expect(html).toContain('class="help-code-example"');
expect(html).toContain("```mermaid\nflowchart LR\n  A[Start] --&gt; B[Finish]\n```");
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- src/components/HelpDialog.test.tsx
```

Expected: both locale tests fail because `Mermaid diagrams` and `Mermaid図` are absent.

- [ ] **Step 3: Extend the Help section model and localized content**

In `src/components/HelpDialog.tsx`, extend `HelpSection`:

```tsx
type HelpSection = {
  title: string;
  paragraphs: string[];
  examples?: Array<{ source: string; meaning: string }>;
  codeExample?: string;
};
```

Add this section after `Markdown basics` in the English `sections` array:

```tsx
{
  title: "Mermaid diagrams",
  paragraphs: [
    "Write a fenced code block labeled mermaid to render a diagram in Preview.",
  ],
  codeExample: "```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```",
},
```

Add this section after the Japanese Markdown basics section:

```tsx
{
  title: "Mermaid図",
  paragraphs: [
    "mermaidと指定したコードブロックを書くと、プレビューに図として表示されます。",
  ],
  codeExample: "```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```",
},
```

- [ ] **Step 4: Render the multiline example and preserve the wide-card layout**

Replace the Help section opening element with:

```tsx
<section
  className={`help-section${section.examples || section.codeExample ? " help-section-wide" : ""}`}
  key={section.title}
>
```

After the existing `section.examples` rendering block, add:

```tsx
{section.codeExample && (
  <pre className="help-code-example"><code>{section.codeExample}</code></pre>
)}
```

In `src/styles.css`, replace `.help-section:last-child` with `.help-section-wide`, including the matching mobile rule, and add:

```css
.help-code-example {
  margin: 14px 0 0;
  padding: 12px;
  overflow-x: auto;
  border: 1px solid var(--preview-code-border);
  border-radius: 6px;
  background: var(--preview-code-bg);
  color: var(--preview-code-text);
  white-space: pre;
}

.help-code-example code {
  font: inherit;
}
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```powershell
npm test -- src/components/HelpDialog.test.tsx
```

Expected: 1 test file passes with 3 passing tests, including the independent English and Japanese locale tests.

- [ ] **Step 6: Run regression tests and production build**

Run:

```powershell
npm test
npm run build
```

Expected: the full Vitest suite passes with zero failures, and Vite exits successfully. Existing large-chunk warnings for Mermaid/Excalidraw are acceptable.

- [ ] **Step 7: Commit the implementation**

```powershell
git add src/components/HelpDialog.test.tsx src/components/HelpDialog.tsx src/styles.css
git commit -m "feat: document Mermaid syntax in help"
```
