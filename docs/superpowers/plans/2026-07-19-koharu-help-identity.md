# Koharu Help Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present Koharu's release flower artwork as a large, centered, accessible identity hero at the top of the Help dialog.

**Architecture:** Keep the identity presentation inside the existing `HelpDialog` component because it is static, localized Help content. Serve an unchanged copy of the canonical artwork from Vite's `public/` directory, and style the hero through the existing Help-specific CSS with one responsive breakpoint.

**Tech Stack:** React 18, TypeScript, Vitest server rendering, Vite public assets, CSS.

## Global Constraints

- Use `asset/releaseicon.png` as the canonical source artwork; do not crop, recolor, regenerate, or otherwise alter it.
- Serve the copied asset at `/koharu-release-icon.png`.
- Render the artwork at exactly 160 by 160 pixels normally and 120 by 120 pixels when the viewport is at most 700 pixels wide.
- Place the centered identity hero below the Help toolbar and above all existing Help sections.
- Keep `Koharu` visible as text and localize the image alternative text as `Koharu flower icon` and `Koharuの花のアイコン`.
- Preserve all existing Help section wording, Markdown examples, shortcuts, close controls, dialog semantics, keyboard behavior, and vertical scrolling.
- Do not change the app icon, toolbar, About dialog, splash screen, or other application surfaces.
- Preserve unrelated workspace changes; stage only the files named in this plan.

---

### Task 1: Add the Help identity hero

**Files:**
- Create: `public/koharu-release-icon.png`
- Modify: `src/components/HelpDialog.test.tsx`
- Modify: `src/components/HelpDialog.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: the canonical binary asset `asset/releaseicon.png` and the existing `HelpDialog({ language, onClose })` props.
- Produces: the public URL `/koharu-release-icon.png`, the localized `HelpContent.identityAlt: string`, and Help-specific classes `help-identity`, `help-identity-icon`, `help-identity-name`, and `help-identity-introduction`.

- [ ] **Step 1: Write the failing rendering assertions**

Extend the existing Japanese and English cases in `src/components/HelpDialog.test.tsx`:

```tsx
it("renders beginner help in Japanese", () => {
  const html = renderToStaticMarkup(
    <HelpDialog language="ja" onClose={() => undefined} />,
  );

  expect(html).toContain('class="help-identity"');
  expect(html).toContain('src="/koharu-release-icon.png"');
  expect(html).toContain('alt="Koharuの花のアイコン"');
  expect(html).toContain('<strong class="help-identity-name">Koharu</strong>');
  expect(html).toContain("Koharuの使い方");
  expect(html).toContain("ファイルを作る・開く・保存する");
  expect(html).toContain("Markdownの書き方");
  expect(html).toContain("Ctrl+S");
  expect(html).toContain("プレビューを切り替える");
  expect(html).toContain("Ctrl+Shift+V");
  expect(html).toContain('role="dialog"');
  expect(html).toContain('aria-modal="true"');
  expect(html).toContain('aria-label="Koharuの使い方を閉じる"');
});

it("renders beginner help in English", () => {
  const html = renderToStaticMarkup(
    <HelpDialog language="en" onClose={() => undefined} />,
  );

  expect(html).toContain('class="help-identity"');
  expect(html).toContain('src="/koharu-release-icon.png"');
  expect(html).toContain('alt="Koharu flower icon"');
  expect(html).toContain('<strong class="help-identity-name">Koharu</strong>');
  expect(html).toContain("How to use Koharu");
  expect(html).toContain("Create, open, and save files");
  expect(html).toContain("Markdown basics");
  expect(html).toContain("Ctrl+F");
  expect(html).toContain("Toggle preview");
  expect(html).toContain("Close How to use Koharu");
});
```

- [ ] **Step 2: Run the focused test and verify the new assertions fail**

Run:

```powershell
npm test -- src/components/HelpDialog.test.tsx
```

Expected: FAIL because the rendered dialog does not contain `help-identity`, `/koharu-release-icon.png`, or either localized alternative text. The existing Escape-key test remains passing.

- [ ] **Step 3: Copy the canonical release artwork without modifying it**

Run:

```powershell
Copy-Item -LiteralPath asset\releaseicon.png -Destination public\koharu-release-icon.png
Get-FileHash asset\releaseicon.png,public\koharu-release-icon.png
```

Expected: both SHA-256 hashes are identical.

- [ ] **Step 4: Add localized identity content and hero markup**

In `src/components/HelpDialog.tsx`, add the alternative-text field to `HelpContent`:

```ts
type HelpContent = {
  title: string;
  introduction: string;
  identityAlt: string;
  close: string;
  closeLabel: string;
  shortcutsTitle: string;
  actionHeading: string;
  shortcutHeading: string;
  sections: HelpSection[];
  shortcuts: Array<{ action: string; keys: string }>;
};
```

Add the localized values alongside each `introduction`:

```ts
identityAlt: "Koharu flower icon",
```

```ts
identityAlt: "Koharuの花のアイコン",
```

Keep the toolbar title and close button, but move `content.introduction` out of the toolbar. Insert this hero as the first child of `.help-dialog-body`, before `.help-sections`:

```tsx
<div className="help-identity">
  <img
    className="help-identity-icon"
    src="/koharu-release-icon.png"
    alt={content.identityAlt}
  />
  <strong className="help-identity-name">Koharu</strong>
  <p className="help-identity-introduction">{content.introduction}</p>
</div>
```

The toolbar's text block becomes:

```tsx
<div>
  <strong id="help-dialog-title">{content.title}</strong>
</div>
```

- [ ] **Step 5: Style the centered responsive hero**

Add these rules immediately after `.help-dialog-body` in `src/styles.css`:

```css
.help-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 0 20px;
  text-align: center;
}

.help-identity-icon {
  width: 160px;
  height: 160px;
  object-fit: contain;
}

.help-identity-name {
  margin-top: 10px;
  color: var(--preview-heading);
  font-size: 24px;
}

.help-identity-introduction {
  max-width: 520px;
  margin: 4px 0 0;
  color: var(--muted);
  line-height: 1.5;
}
```

Add the exact narrow-window size inside the existing `@media (max-width: 700px)` block:

```css
.help-identity-icon {
  width: 120px;
  height: 120px;
}
```

- [ ] **Step 6: Run the focused test and verify it passes**

Run:

```powershell
npm test -- src/components/HelpDialog.test.tsx
```

Expected: PASS for the Japanese rendering, English rendering, and Escape-key behavior.

- [ ] **Step 7: Run complete verification**

Run:

```powershell
npm test
npm run build
git diff --check -- public/koharu-release-icon.png src/components/HelpDialog.test.tsx src/components/HelpDialog.tsx src/styles.css
```

Expected: all Vitest tests pass; TypeScript and Vite production build exit successfully; `git diff --check` reports no whitespace errors. Vite's existing large-chunk notices may appear as warnings.

- [ ] **Step 8: Inspect the scoped diff and commit only the identity feature**

Run:

```powershell
git diff -- src/components/HelpDialog.test.tsx src/components/HelpDialog.tsx src/styles.css
git status --short
git add -- public/koharu-release-icon.png src/components/HelpDialog.test.tsx src/components/HelpDialog.tsx src/styles.css
git commit -m "feat: add Koharu identity to help"
```

Expected: the commit contains exactly the copied image and the three Help feature files. Existing Markdown preview changes, generated build information, `Untitled.md`, `exports/`, `asset/releaseicon.png`, and `.superpowers/` remain outside this commit.
