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
let scrollIntoView: ReturnType<typeof vi.fn>;

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

async function shortcut(target: EventTarget, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function click(target: HTMLElement) {
  await act(async () => {
    target.click();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  window.localStorage.setItem("koharu-language", "en");
  window.localStorage.setItem("koharu-editor-mode", "preview");
  window.localStorage.setItem("koharu-toolbar-hint-dismissed", "true");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(matchMedia) });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
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
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  vi.clearAllMocks();
});

describe("Preview outline navigation", () => {
  it("scrolls duplicate ATX headings by source ID past Setext and raw headings and tolerates a missing target", async () => {
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\outline.md");
    tauriMocks.readTextFile.mockResolvedValueOnce({
      path: "C:\\notes\\outline.md",
      content: "Setext\n=======\n\n<h2>Raw</h2>\n\n# Same\n\n# Same",
    });
    await shortcut(window, "o");

    const outlineButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Outline"] button'),
    );
    expect(outlineButtons.map((button) => button.textContent)).toEqual(["Same", "Same"]);

    await click(outlineButtons[0]);
    await click(outlineButtons[1]);
    expect(scrollIntoView.mock.contexts.map((target) => (target as HTMLElement).id)).toEqual([
      "markdown-heading-30",
      "markdown-heading-38",
    ]);
    expect(scrollIntoView).toHaveBeenNthCalledWith(1, { block: "start", behavior: "smooth" });
    expect(scrollIntoView).toHaveBeenNthCalledWith(2, { block: "start", behavior: "smooth" });

    container.querySelector("#markdown-heading-38")?.remove();
    await click(outlineButtons[1]);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
