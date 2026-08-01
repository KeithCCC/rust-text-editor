// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The frontend tsconfig intentionally excludes Node builtin types.
import { readFileSync } from "node:fs";

const applicationStyles = readFileSync("src/styles.css", "utf8");

describe("preview mode layout", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.head.querySelectorAll("style").forEach((style) => style.remove());
  });

  it("removes the aria-hidden editor pane from layout", () => {
    const style = document.createElement("style");
    style.textContent = applicationStyles;
    const editorPane = document.createElement("article");
    editorPane.className = "editor-pane";
    editorPane.setAttribute("aria-hidden", "true");
    document.head.append(style);
    document.body.append(editorPane);

    expect(getComputedStyle(editorPane).display).toBe("none");
  });
});
