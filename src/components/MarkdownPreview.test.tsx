import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

describe("MarkdownPreview", () => {
  it("renders a single source newline as a visible line break", () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        markdown={"First line\nSecond line"}
        currentFile={null}
        themeMode="light"
        onOpenExcalidraw={() => undefined}
        onOpenRelativeMarkdownLink={() => undefined}
      />,
    );

    expect(html).toContain("First line<br/>\nSecond line");
  });

  it("gives duplicate ATX headings source-offset IDs without changing Setext or raw headings", () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        markdown={"Setext\n=======\n\n<h2 id=\"raw-heading\">Raw</h2>\n\n# Same\n\n# Same"}
        currentFile={null}
        themeMode="light"
        onOpenExcalidraw={() => undefined}
        onOpenRelativeMarkdownLink={() => undefined}
      />,
    );

    expect(html).toContain("<h1>Setext</h1>");
    expect(html).toContain('<h2 id="raw-heading">Raw</h2>');
    expect(html).toContain('<h1 id="markdown-heading-47">Same</h1>');
    expect(html).toContain('<h1 id="markdown-heading-55">Same</h1>');
  });

  it("keeps ReactMarkdown source offsets aligned for CRLF headings", () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        markdown={"# First\r\n\r\n# Second"}
        currentFile={null}
        themeMode="light"
        onOpenExcalidraw={() => undefined}
        onOpenRelativeMarkdownLink={() => undefined}
      />,
    );

    expect(html).toContain('<h1 id="markdown-heading-0">First</h1>');
    expect(html).toContain('<h1 id="markdown-heading-11">Second</h1>');
  });

  it("aligns indented ATX IDs with opening-hash offsets", () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        markdown={"  # Indented\r\n\r\n   ## Deeper"}
        currentFile={null}
        themeMode="light"
        onOpenExcalidraw={() => undefined}
        onOpenRelativeMarkdownLink={() => undefined}
      />,
    );

    expect(html).toContain('<h1 id="markdown-heading-2">Indented</h1>');
    expect(html).toContain('<h2 id="markdown-heading-19">Deeper</h2>');
  });
});
