// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The frontend tsconfig intentionally excludes Node builtin types.
import { readFileSync } from "node:fs";

const applicationStyles = readFileSync("src/styles.css", "utf8");

describe("interface typography", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.head.querySelectorAll("style").forEach((style) => style.remove());
  });

  it("renders ordinary interface text at the compact 13px size", () => {
    const style = document.createElement("style");
    // jsdom does not resolve custom properties in computed styles, so provide
    // the real default value while retaining the production selectors.
    style.textContent = applicationStyles.replaceAll("var(--ui-font-size)", "13px");
    const app = document.createElement("div");
    app.className = "app-shell";

    const menuTitle = document.createElement("button");
    menuTitle.className = "menu-title";

    const baseButton = document.createElement("button");

    const menuPopover = document.createElement("div");
    menuPopover.className = "menu-popover";
    const menuItem = document.createElement("button");
    menuPopover.append(menuItem);

    const outline = document.createElement("aside");
    outline.className = "outline-panel";
    const outlineHeader = document.createElement("header");
    const outlineTitle = document.createElement("strong");
    const outlineEmpty = document.createElement("p");
    outlineHeader.append(outlineTitle);
    outline.append(outlineHeader, outlineEmpty);

    const paneHeader = document.createElement("header");
    paneHeader.className = "pane-header";
    const paneTitle = document.createElement("span");
    const paneCaption = document.createElement("small");
    paneHeader.append(paneTitle, paneCaption);

    const toolbar = document.createElement("div");
    toolbar.className = "markdown-toolbar";
    const toolbarButton = document.createElement("button");
    toolbar.append(toolbarButton);

    const modeSwitcher = document.createElement("div");
    modeSwitcher.className = "view-mode-switcher";
    const modeButton = document.createElement("button");
    modeSwitcher.append(modeButton);

    const noteSearch = document.createElement("div");
    noteSearch.className = "note-search";
    const noteSearchInput = document.createElement("input");
    noteSearch.append(noteSearchInput);

    const appearanceSettings = document.createElement("div");
    appearanceSettings.className = "appearance-settings-body";
    const appearanceOutput = document.createElement("output");
    appearanceSettings.append(appearanceOutput);

    const editor = document.createElement("div");
    editor.className = "markdown-editor";
    const cmEditor = document.createElement("div");
    cmEditor.className = "cm-editor";
    const editorPlaceholder = document.createElement("span");
    editorPlaceholder.className = "cm-placeholder";
    cmEditor.append(editorPlaceholder);
    editor.append(cmEditor);

    app.append(
      menuTitle,
      baseButton,
      menuPopover,
      outline,
      paneHeader,
      toolbar,
      modeSwitcher,
      noteSearch,
      appearanceSettings,
      editor,
    );
    document.head.append(style);
    document.body.append(app);

    for (const element of [
      menuTitle,
      baseButton,
      menuItem,
      outlineTitle,
      outlineEmpty,
      paneTitle,
      paneCaption,
      toolbarButton,
      modeButton,
      noteSearchInput,
      appearanceOutput,
      editorPlaceholder,
    ]) {
      expect(getComputedStyle(element).fontSize).toBe("13px");
    }
  });
});
