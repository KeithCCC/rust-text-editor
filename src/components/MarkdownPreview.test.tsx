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
});
