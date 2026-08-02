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

  it("keeps Split editor and preview headers at the same compact height", () => {
    const style = document.createElement("style");
    style.textContent = applicationStyles;
    const workspace = document.createElement("section");
    workspace.className = "workspace is-split";
    const editorPane = document.createElement("article");
    editorPane.className = "editor-pane";
    const editorHeader = document.createElement("header");
    editorHeader.className = "pane-header";
    editorHeader.innerHTML = '<div class="pane-title"><span>Editor</span></div><button class="formatting-toolbar-toggle is-compact">−<span class="formatting-toolbar-toggle-label">Hide formatting toolbar</span></button>';
    const previewPane = document.createElement("article");
    previewPane.className = "preview-pane";
    const previewHeader = document.createElement("header");
    previewHeader.className = "pane-header";
    previewHeader.innerHTML = "<span>Preview</span><small>Markdown preview</small>";
    const searchHeader = document.createElement("header");
    searchHeader.className = "pane-header has-note-search";
    searchHeader.innerHTML = '<div class="note-search"><label>Find</label><input type="search" /></div>';
    editorPane.append(editorHeader, searchHeader);
    previewPane.append(previewHeader);
    workspace.append(editorPane, previewPane);
    document.head.append(style);
    document.body.append(workspace);

    expect(getComputedStyle(editorHeader).height).toBe("24px");
    expect(getComputedStyle(previewHeader).height).toBe("24px");
    expect(getComputedStyle(searchHeader).height).not.toBe("24px");
  });
});
