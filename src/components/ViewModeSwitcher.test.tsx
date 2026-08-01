import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ViewModeSwitcher } from "./ViewModeSwitcher";

it("renders three labelled mode buttons and marks the active mode", () => {
  const html = renderToStaticMarkup(
    <ViewModeSwitcher mode="preview" labels={{ edit: "Edit", split: "Split", preview: "Preview" }} onChange={() => undefined} />,
  );

  expect(html).toContain('aria-label="Edit"');
  expect(html).toContain('aria-label="Split"');
  expect(html).toContain('aria-label="Preview"');
  expect(html).toContain('data-mode="preview"');
  expect(html).toContain('aria-pressed="true"');
  expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
});
