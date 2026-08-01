import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OutlinePanel } from "./OutlinePanel";

it("renders indented heading buttons and an empty state", () => {
  const populated = renderToStaticMarkup(
    <OutlinePanel
      title="Outline"
      emptyText="No headings found"
      headings={[{ id: "markdown-heading-10", level: 2, text: "Details", offset: 10 }]}
      onSelect={() => undefined}
      onClose={() => undefined}
    />,
  );
  expect(populated).toContain("Details");
  expect(populated).toContain("--outline-level:2");
  expect(populated).toContain('aria-label="Close Outline"');
  expect(populated).toContain('title="Close Outline"');

  const empty = renderToStaticMarkup(
    <OutlinePanel title="Outline" emptyText="No headings found" headings={[]} onSelect={() => undefined} onClose={() => undefined} />,
  );
  expect(empty).toContain("No headings found");
});
