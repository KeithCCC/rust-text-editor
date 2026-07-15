import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MenuCheckboxItem, MenuRadioItem } from "./MenuRadioItem";

describe("MenuRadioItem", () => {
  it("renders a checked native radio control with its label", () => {
    const html = renderToStaticMarkup(
      <MenuRadioItem
        name="theme"
        value="dark"
        checked
        label="Dark Theme"
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain('role="menuitemradio"');
    expect(html).toContain('type="radio"');
    expect(html).toContain('name="theme"');
    expect(html).toContain('checked=""');
    expect(html).toContain("Dark Theme");
  });
});

describe("MenuCheckboxItem", () => {
  it("renders a checked native checkbox control with its label", () => {
    const html = renderToStaticMarkup(
      <MenuCheckboxItem
        checked
        label="Preview Pane"
        onToggle={() => undefined}
      />,
    );

    expect(html).toContain('role="menuitemcheckbox"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html).toContain("Preview Pane");
  });
});
