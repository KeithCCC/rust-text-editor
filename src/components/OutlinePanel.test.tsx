import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OutlinePanel } from "./OutlinePanel";

it("renders indented heading buttons and an empty state", () => {
  const populated = renderToStaticMarkup(
    <OutlinePanel
      title="Outline"
      emptyText="No headings found"
      headings={[{ level: 2, text: "Details", offset: 10, index: 0 }]}
      onSelect={() => undefined}
      onClose={() => undefined}
    />,
  );
  expect(populated).toContain("Details");
  expect(populated).toContain("--outline-level:2");

  const empty = renderToStaticMarkup(
    <OutlinePanel title="Outline" emptyText="No headings found" headings={[]} onSelect={() => undefined} onClose={() => undefined} />,
  );
  expect(empty).toContain("No headings found");
});
