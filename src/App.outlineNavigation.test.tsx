// @vitest-environment jsdom

import { EditorView } from "@codemirror/view";
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

function button(label: string, scope: ParentNode = container) {
  const match = Array.from(scope.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent === label);
  if (!match) throw new Error(`${label} button not found`);
  return match;
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

describe("Outline navigation", () => {
  it.each(["Edit", "Split"])(
    "uses live content for an immediate outline click after deleting headings in %s mode",
    async (mode) => {
      const viewModeSwitcher = container.querySelector<HTMLElement>(".view-mode-switcher");
      if (!viewModeSwitcher) throw new Error("View mode switcher not found");
      await click(button(mode, viewModeSwitcher));

      dialogMocks.open.mockResolvedValueOnce("C:\\notes\\live-outline.md");
      tauriMocks.readTextFile.mockResolvedValueOnce({
        path: "C:\\notes\\live-outline.md",
        content: `# First\n\n${"body\n".repeat(100)}# Removed`,
      });
      await shortcut(window, "o");

      const editorElement = container.querySelector<HTMLElement>(".cm-editor");
      if (!editorElement) throw new Error("CodeMirror editor not found");
      const editorView = EditorView.findFromDOM(editorElement);
      if (!editorView) throw new Error("CodeMirror view not found");
      act(() => {
        editorView.dispatch({
          changes: { from: 0, to: editorView.state.doc.length, insert: "# Now" },
        });
      });

      const outlineButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Outline"] button'),
      );
      const lastOutlineButton = outlineButtons[outlineButtons.length - 1];
      if (!lastOutlineButton) throw new Error("Outline heading not found");
      await click(lastOutlineButton);

      expect(outlineButtons.map((outlineButton) => outlineButton.textContent)).toEqual(["Now"]);
      expect(editorView.state.selection.main).toMatchObject({ from: 0, to: 5 });
    },
  );

  it("scrolls duplicate ATX headings past Setext and spoofed raw IDs and tolerates a missing target", async () => {
    dialogMocks.open.mockResolvedValueOnce("C:\\notes\\outline.md");
    tauriMocks.readTextFile.mockResolvedValueOnce({
      path: "C:\\notes\\outline.md",
      content: "Setext\n=======\n\n<h2 id=\"markdown-heading-55\">Raw</h2>\n\n# Same\n\n# Same",
    });
    await shortcut(window, "o");

    const outlineButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Outline"] button'),
    );
    expect(outlineButtons.map((button) => button.textContent)).toEqual(["Same", "Same"]);

    await click(outlineButtons[0]);
    await click(outlineButtons[1]);
    expect(scrollIntoView.mock.contexts.map((target) => (target as HTMLElement).id)).toEqual([
      "markdown-heading-55",
      "markdown-heading-63",
    ]);
    expect(scrollIntoView.mock.contexts.map((target) => (target as HTMLElement).textContent)).toEqual([
      "Same",
      "Same",
    ]);
    expect(scrollIntoView).toHaveBeenNthCalledWith(1, { block: "start", behavior: "smooth" });
    expect(scrollIntoView).toHaveBeenNthCalledWith(2, { block: "start", behavior: "smooth" });

    Array.from(container.querySelectorAll("#markdown-heading-63"))
      .find((heading) => heading.textContent === "Same")
      ?.remove();
    await click(outlineButtons[1]);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
