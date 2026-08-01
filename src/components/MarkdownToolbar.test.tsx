import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MarkdownToolbar } from "./MarkdownToolbar";

it("offers every initial-scope Markdown action with a tooltip", () => {
  const html = renderToStaticMarkup(<MarkdownToolbar onFormat={() => undefined} />);
  for (const label of ["Heading", "Bold", "Italic", "Strikethrough", "Link", "Bullet List", "Numbered List", "Task List", "Quote", "Inline Code", "Code Block", "Table", "Mermaid"]) {
    expect(html).toContain(`title="${label}"`);
  }
});
