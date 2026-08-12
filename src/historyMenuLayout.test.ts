// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The frontend tsconfig intentionally excludes Node builtin types.
import { readFileSync } from "node:fs";

const applicationStyles = readFileSync("src/styles.css", "utf8");

describe("History menu layout", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.head.querySelectorAll("style").forEach((style) => style.remove());
  });

  it("caps the popover to the viewport and scrolls overflowing entries", () => {
    const style = document.createElement("style");
    style.textContent = applicationStyles;
    const popover = document.createElement("div");
    popover.className = "menu-popover history-menu-popover";
    document.head.append(style);
    document.body.append(popover);

    const computed = getComputedStyle(popover);
    expect(computed.maxHeight).toBe("calc(100vh - 40px)");
    expect(computed.overflowY).toBe("auto");
  });
});
