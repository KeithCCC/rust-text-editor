import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownFormatMenu, MarkdownToolbar } from "./MarkdownToolbar";

describe("MarkdownToolbar", () => {
  it("renders three named groups and Heading, List, Code Block, and More menus", () => {
    const html = renderToStaticMarkup(<MarkdownToolbar language="en" onFormat={() => undefined} />);

    expect(html).toContain('role="group" aria-label="Text"');
    expect(html).toContain('role="group" aria-label="Block"');
    expect(html).toContain('role="group" aria-label="Insert"');
    for (const menu of ["Heading", "List", "Code Block", "More"]) {
      expect(html).toContain(`aria-label="${menu}" aria-haspopup="menu"`);
    }
    for (const item of [
      "Heading 1", "Heading 6", "Bullet list", "Numbered list", "Task list",
      "Plain text", "Markdown", "JavaScript", "TypeScript", "JSON", "Rust", "Bash", "PowerShell",
    ]) {
      expect(html).toContain(`aria-label="${item}"`);
    }
  });

  it("uses localized accessible names and explanatory tooltips", () => {
    const html = renderToStaticMarkup(<MarkdownToolbar language="ja" onFormat={() => undefined} />);

    expect(html).toContain('aria-label="Markdown 書式設定"');
    expect(html).toContain('aria-label="文中コード"');
    expect(html).toContain('aria-label="コードブロック" aria-haspopup="menu"');
    expect(html).toContain('title="選択した短いコードを文中コードとして表示します"');
    expect(html).not.toContain("譁・ｸｭ");
  });

  it("exposes shortcuts, known pressed state, and one roving tab stop", () => {
    const html = renderToStaticMarkup(
      <MarkdownToolbar
        language="en"
        formattingContext={{
          headingLevel: null,
          bold: true,
          italic: false,
          strikethrough: false,
          inlineCode: false,
        }}
        onFormat={() => undefined}
      />,
    );

    expect(html).toContain('aria-keyshortcuts="Control+B Meta+B"');
    expect(html).toContain('aria-keyshortcuts="Control+I Meta+I"');
    expect(html).toMatch(/aria-label="Bold"[^>]*aria-pressed="true"/);
    expect((html.match(/tabindex="0"/g) ?? [])).toHaveLength(1);
    expect(html).toContain('tabindex="-1"');
  });

  it("disables every control and exposes duplicate narrow-layout actions in More", () => {
    const html = renderToStaticMarkup(<MarkdownToolbar language="en" disabled onFormat={() => undefined} />);

    expect(html).toMatch(/aria-label="Bold"[^>]*disabled=""[^>]*aria-disabled="true"/);
    expect((html.match(/aria-label="Strikethrough"/g) ?? [])).toHaveLength(2);
    expect((html.match(/aria-label="Table"/g) ?? [])).toHaveLength(2);
    expect((html.match(/aria-label="Mermaid diagram"/g) ?? [])).toHaveLength(2);
  });
});

describe("MarkdownFormatMenu", () => {
  it("offers the same localized semantic actions as the toolbar", () => {
    const html = renderToStaticMarkup(
      <MarkdownFormatMenu language="ja" onFormat={() => undefined} />,
    );

    for (const label of ["見出し 6", "太字", "チェックリスト", "PowerShell", "表", "図（Mermaid）"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain('aria-keyshortcuts="Control+B Meta+B"');
  });
});
