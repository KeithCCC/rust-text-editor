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

function editorPane() {
  const pane = container.querySelector<HTMLElement>(".editor-pane");
  if (!pane) throw new Error("Editor pane not found");
  return pane;
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

async function openHelpFromMenu() {
  const invoker = button("Help");
  await click(invoker);
  const menuItem = button("How to use Koharu");
  focus(menuItem);
  await click(menuItem);
  return { invoker, menuItem };
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
  it("toggles the formatting toolbar from the pane header and persists the choice", async () => {
    const toggle = button("Hide formatting toolbar", editorPane());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe("formatting-toolbar-region");
    expect(editorPane().classList.contains("has-formatting-toolbar")).toBe(true);
    expect(editorPane().querySelector("#formatting-toolbar-region")).not.toBeNull();

    await click(toggle);

    expect(button("Show formatting toolbar", editorPane()).getAttribute("aria-expanded")).toBe("false");
    expect(editorPane().classList.contains("has-formatting-toolbar")).toBe(false);
    expect(editorPane().querySelector("#formatting-toolbar-region")).toBeNull();
    expect(window.localStorage.getItem("koharu-formatting-toolbar-visibility")).toBe("hidden");
  });

  it("restores a hidden formatting toolbar preference on mount", async () => {
    act(() => root.unmount());
    window.localStorage.setItem("koharu-formatting-toolbar-visibility", "hidden");
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(button("Show formatting toolbar", editorPane()).getAttribute("aria-expanded")).toBe("false");
    expect(editorPane().querySelector("#formatting-toolbar-region")).toBeNull();
  });

  it("renders the message area after the editor and localizes the toggle", async () => {
    const pane = editorPane();
    const editor = pane.querySelector(".markdown-editor");
    const messageArea = pane.querySelector(".editor-message-area");
    if (!editor || !messageArea) throw new Error("Editor layout regions not found");
    expect(editor.compareDocumentPosition(messageArea) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(messageArea.querySelector(".formatting-feedback")).not.toBeNull();

    await click(button("View"));
    const viewMenu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
    const japaneseUi = viewMenu?.querySelector<HTMLInputElement>('input[name="language"][value="ja"]');
    if (!japaneseUi) throw new Error("Japanese UI choice not found");
    await click(japaneseUi);

    expect(button("書式バーを隠す", editorPane()).getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps guidance at the bottom and the toggle available only with a visible editor pane", async () => {
    act(() => root.unmount());
    window.localStorage.removeItem("koharu-toolbar-hint-dismissed");
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    const pane = editorPane();
    expect(pane.querySelector(".editor-message-area .toolbar-hint")).not.toBeNull();
    expect(pane.querySelector(".formatting-toolbar-region .toolbar-hint")).toBeNull();

    const switcher = container.querySelector<HTMLElement>(".view-mode-switcher");
    if (!switcher) throw new Error("View mode switcher not found");
    await click(button("Split", switcher));
    expect(pane.hidden).toBe(false);
    expect(button("Hide formatting toolbar", pane)).not.toBeNull();

    await click(button("Preview", switcher));
    expect(pane.hidden).toBe(true);
    expect(pane.getAttribute("aria-hidden")).toBe("true");
  });

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

  it("exposes one focusable English Preview reason outside the hidden editor pane", async () => {
    const viewModeSwitcher = container.querySelector(".view-mode-switcher");
    if (!viewModeSwitcher) throw new Error("View mode switcher not found");

    await click(button("Preview", viewModeSwitcher));

    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]');
    if (!toolbar) throw new Error("Markdown toolbar not found");
    const previewPane = container.querySelector<HTMLElement>(".preview-pane");
    if (!previewPane) throw new Error("Preview pane not found");
    const status = previewPane.querySelector<HTMLElement>('[role="status"]');
    expect(status?.textContent).toBe(
      "Formatting is unavailable in Preview. Switch to Edit or Split to make changes.",
    );
    expect(status?.tabIndex).toBe(0);
    expect(status?.closest(".editor-pane")).toBeNull();
    expect(toolbar.getAttribute("aria-describedby")).toBeNull();
    expect(toolbar.querySelector('[role="status"]')).toBeNull();
    expect(Array.from(container.querySelectorAll('[role="status"]')).filter((candidate) => (
      candidate.textContent?.includes("Formatting is unavailable in Preview")
    ))).toHaveLength(1);
  });

  it("exposes one focusable Japanese Preview reason in the visible preview pane", async () => {
    await click(button("View"));
    const viewMenu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
    if (!viewMenu) throw new Error("View menu not found");
    const japaneseUi = viewMenu.querySelector<HTMLInputElement>('input[name="language"][value="ja"]');
    if (!japaneseUi) throw new Error("Japanese UI choice not found");
    await click(japaneseUi);
    const viewModeSwitcher = container.querySelector(".view-mode-switcher");
    if (!viewModeSwitcher) throw new Error("View mode switcher not found");

    await click(button("プレビュー", viewModeSwitcher));

    const status = container.querySelector<HTMLElement>('.preview-pane [role="status"]');
    expect(status?.textContent).toBe(
      "プレビュー表示では書式設定を使用できません。編集または分割表示に切り替えてください。",
    );
    expect(status?.tabIndex).toBe(0);
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
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

  it("restores Help focus to the visible top-level Help button instead of its hidden menu item", async () => {
    const { invoker, menuItem } = await openHelpFromMenu();
    const close = button("Close How to use Koharu");
    expect(document.activeElement).toBe(close);

    await shortcut(close, "Escape", { ctrlKey: false });

    expect(container.querySelector('#help-dialog-title')).toBeNull();
    expect(invoker.closest('.menu-root')?.getAttribute('data-open')).toBe("false");
    expect(document.activeElement).toBe(invoker);
    expect(document.activeElement).not.toBe(menuItem);
  });

  it("does not open Help while an unsaved-decision dialog owns the modal layer", async () => {
    await shortcut(window, "b");
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\decision-first.md");
    await shortcut(window, "o");
    const cancel = button("Cancel");
    expect(document.activeElement).toBe(cancel);

    const helpInvoker = button("Help");
    expect(helpInvoker.disabled).toBe(true);
    await click(helpInvoker);
    await click(button("How to use Koharu"));

    expect(container.querySelector('#help-dialog-title')).toBeNull();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.activeElement).toBe(cancel);
  });

  it("closes Help before a new unsaved-decision dialog takes focus", async () => {
    await shortcut(window, "b");
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\decision-after-help.md");
    await openHelpFromMenu();
    await click(button("File"));
    const fileMenu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
    if (!fileMenu) throw new Error("File menu not found");
    const openItem = Array.from(fileMenu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'))
      .find((candidate) => candidate.textContent?.startsWith("Open"));
    if (!openItem) throw new Error("Open menu item not found");

    await click(openItem);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(container.querySelector('#help-dialog-title')).toBeNull();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.activeElement).toBe(button("Cancel"));
  });
});
