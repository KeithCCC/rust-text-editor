// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}));

const tauriMocks = vi.hoisted(() => ({
  appendDebugLog: vi.fn(),
  deleteRecoveryDraft: vi.fn(),
  exitApp: vi.fn(),
  getDebugLogPath: vi.fn(),
  getFileProperties: vi.fn(),
  getStartupFilePath: vi.fn(),
  openFileInNewInstance: vi.fn(),
  readExcalidrawFile: vi.fn(),
  readRecoveryDraft: vi.fn(),
  readTextFile: vi.fn(),
  resolveRelativePath: vi.fn(),
  writeBinaryFile: vi.fn(),
  writeExcalidrawFile: vi.fn(),
  writeRecoveryDraft: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);
vi.mock("./tauri", () => tauriMocks);

let container: HTMLDivElement;
let root: Root;

function matchMedia(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

async function shortcut(target: EventTarget, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    ...options,
  });
  await act(async () => {
    target.dispatchEvent(event);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
  return event;
}

function editorContent() {
  const editor = container.querySelector<HTMLElement>(".cm-content");
  if (!editor) throw new Error("CodeMirror content element not found");
  return editor.textContent ?? "";
}

function button(label: string, scope: ParentNode = container) {
  const match = Array.from(scope.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.getAttribute("aria-label") === label || candidate.textContent === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

async function click(target: HTMLElement) {
  await act(async () => {
    target.click();
    await Promise.resolve();
  });
}

function focus(target: HTMLElement) {
  act(() => target.focus());
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  window.localStorage.setItem("koharu-language", "en");
  window.localStorage.setItem("koharu-editor-mode", "edit");
  window.localStorage.setItem("koharu-toolbar-hint-dismissed", "true");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(matchMedia) });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  tauriMocks.appendDebugLog.mockResolvedValue(undefined);
  tauriMocks.deleteRecoveryDraft.mockResolvedValue(undefined);
  tauriMocks.writeTextFile.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  vi.clearAllMocks();
});

describe("document session safety", () => {
  it("focuses the replacement editor after a successful Open from the focused editor", async () => {
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\focused-open.md");
    tauriMocks.readTextFile.mockResolvedValueOnce({
      path: "C:\\notes\\focused-open.md",
      content: "replacement",
    });
    const previousEditor = container.querySelector<HTMLElement>(".cm-content");
    if (!previousEditor) throw new Error("CodeMirror content element not found");
    focus(previousEditor);
    expect(document.activeElement).toBe(previousEditor);

    await shortcut(previousEditor, "o");

    const replacementEditor = container.querySelector<HTMLElement>(".cm-content");
    if (!replacementEditor) throw new Error("Replacement CodeMirror editor not found");
    expect(replacementEditor).not.toBe(previousEditor);
    expect(editorContent()).toBe("replacement");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    });
    expect(document.activeElement).toBe(replacementEditor);
  });

  it("keeps the existing editor focused when Open is canceled", async () => {
    dialogMocks.open.mockResolvedValueOnce(null);
    const editor = container.querySelector<HTMLElement>(".cm-content");
    if (!editor) throw new Error("CodeMirror content element not found");
    focus(editor);

    await shortcut(editor, "o");

    expect(container.querySelector(".cm-content")).toBe(editor);
    expect(document.activeElement).toBe(editor);
  });

  it("keeps the existing editor focused when Open fails", async () => {
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\missing.md");
    tauriMocks.readTextFile.mockRejectedValueOnce(new Error("File not found"));
    const editor = container.querySelector<HTMLElement>(".cm-content");
    if (!editor) throw new Error("CodeMirror content element not found");
    focus(editor);

    await shortcut(editor, "o");

    expect(container.querySelector(".cm-content")).toBe(editor);
    expect(document.activeElement).toBe(editor);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("File not found");
  });

  it("waits for an unsaved-decision dialog before focusing the successfully opened editor", async () => {
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\after-dialog.md");
    tauriMocks.readTextFile.mockResolvedValueOnce({
      path: "C:\\notes\\after-dialog.md",
      content: "after dialog",
    });
    const previousEditor = container.querySelector<HTMLElement>(".cm-content");
    if (!previousEditor) throw new Error("CodeMirror content element not found");
    focus(previousEditor);
    await shortcut(previousEditor, "b");

    await shortcut(previousEditor, "o");

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error("Unsaved-decision dialog not found");
    expect(document.activeElement).toBe(button("Cancel", dialog));

    await click(button("Don't Save", dialog));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    });

    const replacementEditor = container.querySelector<HTMLElement>(".cm-content");
    if (!replacementEditor) throw new Error("Replacement CodeMirror editor not found");
    expect(replacementEditor).not.toBe(previousEditor);
    expect(editorContent()).toBe("after dialog");
    expect(document.activeElement).toBe(replacementEditor);
  });

  it("does not focus the hidden replacement editor when Open succeeds in Preview", async () => {
    const viewModeSwitcher = container.querySelector(".view-mode-switcher");
    if (!viewModeSwitcher) throw new Error("View mode switcher not found");
    const previewButton = button("Preview", viewModeSwitcher);
    focus(previewButton);
    await click(previewButton);
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\preview-open.md");
    tauriMocks.readTextFile.mockResolvedValueOnce({
      path: "C:\\notes\\preview-open.md",
      content: "preview replacement",
    });

    await shortcut(window, "o");

    expect(editorContent()).toBe("preview replacement");
    expect(document.activeElement).toBe(previewButton);
    expect(document.activeElement).not.toBe(container.querySelector(".cm-content"));
  });

  it("saves newly opened B after Undo instead of restoring and saving document A", async () => {
    dialogMocks.open
      .mockResolvedValueOnce("C:\\notes\\A.md")
      .mockResolvedValueOnce("C:\\notes\\B.md");
    tauriMocks.readTextFile
      .mockResolvedValueOnce({ path: "C:\\notes\\A.md", content: "alpha" })
      .mockResolvedValueOnce({ path: "C:\\notes\\B.md", content: "bravo" });

    await shortcut(window, "o");
    expect(editorContent()).toBe("alpha");

    await shortcut(window, "b");
    expect(editorContent()).not.toBe("alpha");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    });
    await shortcut(window, "s");
    expect(tauriMocks.writeTextFile).toHaveBeenLastCalledWith(
      "C:\\notes\\A.md",
      editorContent(),
    );

    await shortcut(window, "o");
    expect(dialogMocks.open).toHaveBeenCalledTimes(2);
    expect(tauriMocks.readTextFile).toHaveBeenLastCalledWith("C:\\notes\\B.md");

    const editor = container.querySelector<HTMLElement>(".cm-content");
    if (!editor) throw new Error("CodeMirror content element not found");
    await shortcut(editor, "z");
    await shortcut(window, "s");

    expect(tauriMocks.writeTextFile).toHaveBeenLastCalledWith("C:\\notes\\B.md", "bravo");
  });

  it("suppresses Markdown formatting shortcuts while Preview is active", async () => {
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\preview.md");
    tauriMocks.readTextFile.mockResolvedValueOnce({
      path: "C:\\notes\\preview.md",
      content: "plain text",
    });
    await shortcut(window, "o");
    expect(editorContent()).toBe("plain text");

    const viewModeSwitcher = container.querySelector(".view-mode-switcher");
    if (!viewModeSwitcher) throw new Error("View mode switcher not found");
    await click(button("Preview", viewModeSwitcher));
    const before = editorContent();

    expect((await shortcut(window, "b")).defaultPrevented).toBe(true);
    expect((await shortcut(window, "i")).defaultPrevented).toBe(true);
    expect(editorContent()).toBe(before);
  });

  it("disables Markdown and JSON Format-menu actions while Preview is active", async () => {
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\preview.json");
    tauriMocks.readTextFile.mockResolvedValueOnce({
      path: "C:\\notes\\preview.json",
      content: '{"name":"Koharu","ready":true}',
    });
    await shortcut(window, "o");
    const before = editorContent();

    const viewModeSwitcher = container.querySelector(".view-mode-switcher");
    if (!viewModeSwitcher) throw new Error("View mode switcher not found");
    await click(button("Preview", viewModeSwitcher));
    await click(button("Format"));

    const formatMenu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
    if (!formatMenu) throw new Error("Format menu not found");
    const bold = button("Bold", formatMenu);
    const formatJson = button("Format JSON", formatMenu);
    expect(bold.disabled).toBe(true);
    expect(formatJson.disabled).toBe(true);

    await click(bold);
    await click(formatJson);
    expect(editorContent()).toBe(before);
  });

  it("describes Preview-disabled formatting in English through the real toolbar", async () => {
    const viewModeSwitcher = container.querySelector(".view-mode-switcher");
    if (!viewModeSwitcher) throw new Error("View mode switcher not found");

    await click(button("Preview", viewModeSwitcher));

    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]');
    if (!toolbar) throw new Error("Markdown toolbar not found");
    const reasonId = toolbar.getAttribute("aria-describedby");
    expect(reasonId ? document.getElementById(reasonId)?.textContent : null).toBe(
      "Formatting is unavailable in Preview. Switch to Edit or Split to make changes.",
    );
  });

  it("describes document-safety-disabled formatting in Japanese through the real toolbar", async () => {
    await click(button("View"));
    const viewMenu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
    if (!viewMenu) throw new Error("View menu not found");
    const japaneseUi = viewMenu.querySelector<HTMLInputElement>('input[name="language"][value="ja"]');
    if (!japaneseUi) throw new Error("Japanese UI choice not found");
    await click(japaneseUi);
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\pending-ja.md");
    tauriMocks.readTextFile.mockReturnValueOnce(new Promise(() => undefined));

    await shortcut(window, "o");

    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]');
    if (!toolbar) throw new Error("Markdown toolbar not found");
    const reasonId = toolbar.getAttribute("aria-describedby");
    expect(reasonId ? document.getElementById(reasonId)?.textContent : null).toBe(
      "文書を安全に処理している間は書式設定を使用できません。",
    );
  });

  it("uses the same Japanese placeholders from the toolbar and Format menu", async () => {
    await click(button("View"));
    const viewMenu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
    if (!viewMenu) throw new Error("View menu not found");
    const japaneseUi = viewMenu.querySelector<HTMLInputElement>('input[name="language"][value="ja"]');
    if (!japaneseUi) throw new Error("Japanese UI choice not found");
    await click(japaneseUi);

    expect(container.querySelector(".cm-placeholder")?.textContent).toBe("ここに Markdown を入力してください。");
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]');
    if (!toolbar) throw new Error("Markdown toolbar not found");
    await click(button("太字", toolbar));
    expect(editorContent()).toBe("**太字**");

    const editor = container.querySelector<HTMLElement>(".cm-content");
    if (!editor) throw new Error("CodeMirror editor not found");
    await shortcut(editor, "z");
    expect(container.querySelector(".cm-placeholder")?.textContent).toBe("ここに Markdown を入力してください。");

    await click(button("書式"));
    const formatMenu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
    if (!formatMenu) throw new Error("Format menu not found");
    await click(button("太字", formatMenu));
    expect(editorContent()).toBe("**太字**");
  });

  it("preserves same-document editor history, selection, caret, and scroll across Preview", async () => {
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\roundtrip.md");
    tauriMocks.readTextFile.mockResolvedValueOnce({
      path: "C:\\notes\\roundtrip.md",
      content: "alpha",
    });
    await shortcut(window, "o");
    await shortcut(window, "b");
    const afterBold = editorContent();
    expect(afterBold).toBe("**bold text**alpha");

    const editor = container.querySelector<HTMLElement>(".cm-content");
    const scrollElement = container.querySelector<HTMLElement>(".cm-scroller");
    if (!editor || !scrollElement) throw new Error("CodeMirror editor not found");
    scrollElement.scrollTop = 37;

    const viewModeSwitcher = container.querySelector(".view-mode-switcher");
    if (!viewModeSwitcher) throw new Error("View mode switcher not found");
    await click(button("Preview", viewModeSwitcher));
    await shortcut(editor, "z");
    expect(editorContent()).toBe(afterBold);
    await click(button("Edit", viewModeSwitcher));

    expect(container.querySelector(".cm-content")).toBe(editor);
    expect(container.querySelector(".cm-scroller")).toBe(scrollElement);
    expect(scrollElement.scrollTop).toBe(37);

    await shortcut(window, "i");
    expect(editorContent()).toBe("***bold text***alpha");
    await shortcut(editor, "z");
    expect(editorContent()).toBe(afterBold);
    await shortcut(editor, "z");
    expect(editorContent()).toBe("alpha");
  });
});
