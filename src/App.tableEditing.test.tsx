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
  exportPdf: vi.fn(),
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
const pdfMocks = vi.hoisted(() => ({ createPdfHtml: vi.fn() }));
vi.mock("./exportPdf", () => pdfMocks);

const TABLE = "| Name | Value |\n| --- | --- |\n| before | 1 |";
const UPDATED_TABLE = "| Name | Value |\n| --- | --- |\n| after | 1 |";
const COMPOSED_TABLE = "| Name | Value |\n| --- | --- |\n| 日本語 | 1 |";

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

async function flush() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function shortcut(target: EventTarget, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    ...options,
  });
  act(() => target.dispatchEvent(event));
  await flush();
  return event;
}

async function click(target: HTMLElement) {
  act(() => target.click());
  await flush();
}

function button(label: string, scope: ParentNode = container) {
  const match = Array.from(scope.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.getAttribute("aria-label") === label || candidate.textContent === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function tableCell(address = "1:0") {
  const cell = container.querySelector<HTMLTextAreaElement>(`[data-table-cell="${address}"]`);
  if (!cell) throw new Error(`Table cell not found: ${address}`);
  return cell;
}

async function openTable(path = "C:\\notes\\table.md") {
  dialogMocks.open.mockResolvedValueOnce(path);
  tauriMocks.readTextFile.mockResolvedValueOnce({ path, content: TABLE });
  await shortcut(window, "o");
  expect(container.querySelector(".koharu-table-wrap")).not.toBeNull();
  return path;
}

function inputCell(cell: HTMLTextAreaElement, value: string) {
  act(() => {
    cell.focus();
    cell.value = value;
    cell.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function startComposition(cell: HTMLTextAreaElement, value: string) {
  act(() => {
    cell.focus();
    cell.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    cell.value = value;
    cell.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, isComposing: true }));
  });
}

async function endComposition(cell: HTMLTextAreaElement) {
  act(() => cell.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
  await flush();
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  window.localStorage.setItem("koharu-language", "en");
  window.localStorage.setItem("koharu-editor-mode", "edit");
  window.localStorage.setItem("koharu-toolbar-hint-dismissed", "true");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(matchMedia) });
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
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

describe("App table editing lifecycle", () => {
  it("waits for cell composition before exporting a PDF snapshot", async () => {
    const path = await openTable();
    const cell = tableCell();
    startComposition(cell, "日本語");
    dialogMocks.save.mockResolvedValueOnce("C:\\notes\\table.pdf");
    pdfMocks.createPdfHtml.mockResolvedValueOnce("<html>table</html>");
    tauriMocks.exportPdf.mockResolvedValueOnce(undefined);
    await click(button("File"));
    await click(button("Export as PDF..."));
    expect(dialogMocks.save).not.toHaveBeenCalled();
    await endComposition(cell);
    await flush();
    expect(pdfMocks.createPdfHtml).toHaveBeenCalledWith(expect.objectContaining({ content: COMPOSED_TABLE, currentFile: path }));
    expect(tauriMocks.exportPdf).toHaveBeenCalledWith("C:\\notes\\table.pdf", "<html>table</html>");
    expect(container.querySelector(".statusbar")?.textContent).toContain("Unsaved");
  });

  it("saves the latest cell input without moving focus", async () => {
    const path = await openTable();
    const cell = tableCell();
    inputCell(cell, "after");

    await shortcut(cell, "s");

    expect(tauriMocks.writeTextFile).toHaveBeenCalledOnce();
    expect(tauriMocks.writeTextFile).toHaveBeenCalledWith(path, UPDATED_TABLE);
    expect(document.activeElement).toBe(cell);
  });

  it("waits for composition and suppresses duplicate saves", async () => {
    const path = await openTable();
    const cell = tableCell();
    startComposition(cell, "日本語");

    await shortcut(cell, "s", { isComposing: true });
    await shortcut(cell, "s", { isComposing: true });

    expect(dialogMocks.save).not.toHaveBeenCalled();
    expect(tauriMocks.writeTextFile).not.toHaveBeenCalled();

    await endComposition(cell);

    expect(tauriMocks.writeTextFile).toHaveBeenCalledOnce();
    expect(tauriMocks.writeTextFile).toHaveBeenCalledWith(path, COMPOSED_TABLE);
  });

  it("waits for composition and preserves the latest cell edit when a transition is canceled", async () => {
    await openTable();
    const cell = tableCell();
    startComposition(cell, "日本語");

    await shortcut(cell, "n");
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await endComposition(cell);
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error("Unsaved-decision dialog not found");
    await click(button("Cancel", dialog));

    expect(tableCell().value).toBe("日本語");
    expect(container.querySelector(".koharu-table-wrap")).not.toBeNull();
    expect(tauriMocks.writeTextFile).not.toHaveBeenCalled();
  });

  it("suppresses composing navigation shortcuts instead of queuing a transition", async () => {
    await openTable();
    const cell = tableCell();
    startComposition(cell, "日本語");

    const event = await shortcut(cell, "n", { isComposing: true });
    expect(event.defaultPrevented).toBe(true);
    await endComposition(cell);

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(tableCell().value).toBe("日本語");
  });

  it("waits for composition before switching to Preview", async () => {
    await openTable();
    const cell = tableCell();
    startComposition(cell, "日本語");
    const switcher = container.querySelector<HTMLElement>(".view-mode-switcher");
    if (!switcher) throw new Error("View mode switcher not found");

    await click(button("Preview", switcher));
    expect(button("Edit", switcher).getAttribute("aria-pressed")).toBe("true");

    await endComposition(cell);
    expect(button("Preview", switcher).getAttribute("aria-pressed")).toBe("true");
  });

  it("prepares composition before opening Save As and writes its final value", async () => {
    await openTable();
    const cell = tableCell();
    startComposition(cell, "日本語");
    dialogMocks.save.mockResolvedValueOnce("C:\\notes\\copy.md");

    await click(button("File"));
    await click(button("Save As..."));
    expect(dialogMocks.save).not.toHaveBeenCalled();

    await endComposition(cell);

    expect(dialogMocks.save).toHaveBeenCalledOnce();
    expect(tauriMocks.writeTextFile).toHaveBeenCalledWith("C:\\notes\\copy.md", COMPOSED_TABLE);
  });

  it("does not restore cell focus after a failed save", async () => {
    await openTable();
    const cell = tableCell();
    inputCell(cell, "after");
    let rejectWrite!: (error: Error) => void;
    tauriMocks.writeTextFile.mockImplementationOnce(() => new Promise<never>((_resolve, reject) => {
      rejectWrite = reject;
    }));

    await shortcut(cell, "s");
    act(() => button("File").focus());
    await act(async () => {
      rejectWrite(new Error("disk full"));
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("disk full");
    expect(document.activeElement).not.toBe(cell);
    expect((document.activeElement as HTMLElement | null)?.dataset.tableCell).toBeUndefined();
  });

  it("does not run whole-document JSON formatting from an active table cell", async () => {
    await openTable();
    const cell = tableCell();
    act(() => cell.focus());
    await flush();
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    });
    expect(document.activeElement).toBe(cell);

    await click(button("Format"));
    await click(button("Format JSON"));

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(tableCell().value).toBe("before");
  });

  it("keeps queued document autofocus from stealing the table formatting target", async () => {
    await openTable();
    const cell = tableCell();
    act(() => {
      cell.focus();
      cell.setSelectionRange(0, cell.value.length);
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    });
    expect(document.activeElement).toBe(cell);

    await shortcut(cell, "b");
    expect(tableCell().value).toBe("**before**");
  });

  it("reenables whole-document formatting after explicit table-source and body interaction", async () => {
    await openTable();
    const cell = tableCell();
    act(() => cell.focus());
    await click(button("Edit source"));
    const editorBody = container.querySelector<HTMLElement>(".cm-content");
    if (!editorBody) throw new Error("CodeMirror content element not found");
    act(() => editorBody.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));

    await click(button("Format"));
    await click(button("Format JSON"));

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("JSON format failed");
  });

  it("prepares composition before exporting HTML", async () => {
    await openTable();
    const cell = tableCell();
    startComposition(cell, "日本語");
    dialogMocks.save.mockResolvedValueOnce("C:\\notes\\table.html");

    await click(button("File"));
    await click(button("Export as HTML..."));
    expect(dialogMocks.save).not.toHaveBeenCalled();

    await endComposition(cell);

    expect(dialogMocks.save).toHaveBeenCalledOnce();
    expect(tauriMocks.writeTextFile).toHaveBeenCalledOnce();
    expect(tauriMocks.writeTextFile.mock.calls[0][1]).toContain("日本語");
  });
});
