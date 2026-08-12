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

async function renderApp(): Promise<void> {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
  });
}

async function click(target: HTMLElement): Promise<void> {
  await act(async () => {
    target.click();
    await Promise.resolve();
  });
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const match = Array.from(scope.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.getAttribute("aria-label") === label || candidate.textContent === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function openMenu(): HTMLElement {
  const menu = container.querySelector<HTMLElement>('.menu-root[data-open="true"] .menu-popover');
  if (!menu) throw new Error("Open menu not found");
  return menu;
}

function seedRecent(...paths: string[]): void {
  window.localStorage.setItem("koharu-recent-files", JSON.stringify(paths.map((path, index) => ({
    path,
    lastAccessedAt: paths.length - index,
  }))));
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

beforeEach(() => {
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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  vi.clearAllMocks();
});

describe("History menu", () => {
  it("moves recent files out of File and into a top-level History menu", async () => {
    window.localStorage.setItem("koharu-recent-files", JSON.stringify([
      { path: "C:\\notes\\a-very-long-history-filename-that-needs-clipping.md", lastAccessedAt: 2 },
      { path: "C:\\notes\\short.md", lastAccessedAt: 1 },
    ]));
    await renderApp();

    await click(button("File"));
    const fileMenu = openMenu();
    expect(fileMenu.textContent).not.toContain("a-very-long-history-filename-that-needs-clipping.md");
    expect(fileMenu.textContent).not.toContain("Clear Recent Files");

    await click(button("History"));
    const historyMenu = openMenu();
    const longName = button("a-very-long-history-filename-that-needs-clipping.md", historyMenu);
    expect(historyMenu.classList.contains("history-menu-popover")).toBe(true);
    expect(longName.title).toBe("a-very-long-history-filename-that-needs-clipping.md");
    expect(longName.querySelector(".recent-file-name")?.textContent).toBe(
      "a-very-long-history-filename-that-needs-clipping.md",
    );
    expect(longName.querySelector("small")).toBeNull();
    expect(historyMenu.textContent).not.toContain("C:\\notes");
    expect(button("Clear Recent Files", historyMenu)).not.toBeNull();
  });

  it("keeps History available and reports empty history", async () => {
    await renderApp();
    await click(button("History"));
    const empty = openMenu().querySelector<HTMLElement>('.menu-empty[role="menuitem"]');
    expect(empty?.textContent).toBe("No Recent Files");
    expect(empty?.getAttribute("aria-disabled")).toBe("true");
  });

  it("localizes the History menu in Japanese", async () => {
    window.localStorage.setItem("koharu-language", "ja");
    await renderApp();
    await click(button("螻･豁ｴ"));
    expect(openMenu().textContent).toContain("譛霑台ｽｿ縺｣縺溘ヵ繧｡繧､繝ｫ縺ｯ縺ゅｊ縺ｾ縺帙ｓ");
  });

  it("opens a recent file by its stored full path", async () => {
    seedRecent("C:\\notes\\open-me.md");
    tauriMocks.readTextFile.mockResolvedValueOnce({ path: "C:\\notes\\open-me.md", content: "opened" });
    await renderApp();
    await click(button("History"));
    await click(button("open-me.md", openMenu()));
    expect(tauriMocks.readTextFile).toHaveBeenCalledWith("C:\\notes\\open-me.md");
  });

  it("removes one entry and can clear the remainder", async () => {
    seedRecent("C:\\notes\\first.md", "C:\\notes\\second.md");
    await renderApp();
    await click(button("History"));
    await click(button("Remove from recent files: first.md", openMenu()));
    expect(openMenu().textContent).not.toContain("first.md");
    await click(button("Clear Recent Files", openMenu()));
    expect(JSON.parse(window.localStorage.getItem("koharu-recent-files") ?? "[]")).toEqual([]);
  });

  it("removes only a missing recent file after open fails", async () => {
    seedRecent("C:\\notes\\missing.md", "C:\\notes\\kept.md");
    tauriMocks.readTextFile.mockRejectedValueOnce(new Error("missing"));
    await renderApp();
    await click(button("History"));
    await click(button("missing.md", openMenu()));
    await flushEffects();
    const persisted = JSON.parse(window.localStorage.getItem("koharu-recent-files") ?? "[]");
    expect(persisted.map((entry: { path: string }) => entry.path)).toEqual(["C:\\notes\\kept.md"]);
  });
});
