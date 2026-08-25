// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The frontend tsconfig intentionally excludes Node builtin types.
import { readFileSync } from "node:fs";

const applicationStyles = readFileSync("src/styles.css", "utf8");

describe("menu typography", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.head.querySelectorAll("style").forEach((style) => style.remove());
  });

  it("renders top-level menu labels at the Windows menu text size", () => {
    const style = document.createElement("style");
    style.textContent = applicationStyles;
    const app = document.createElement("div");
    app.className = "app-shell";
    app.style.setProperty("--ui-font-size", "13px");
    const menuTitle = document.createElement("button");
    menuTitle.className = "menu-title";
    menuTitle.textContent = "File";
    app.append(menuTitle);
    document.head.append(style);
    document.body.append(app);

    expect(getComputedStyle(menuTitle).fontSize).toBe("14px");
  });
});
