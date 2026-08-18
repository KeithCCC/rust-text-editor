// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("MarkdownPreview link interaction", () => {
  it("delegates HTTPS links instead of navigating the Koharu webview", () => {
    const onOpenExternalLink = vi.fn();

    act(() => {
      root.render(
        <MarkdownPreview
          markdown="[rust-whiteboard](https://github.com/KeithCCC/rust-whiteboard)"
          currentFile={null}
          themeMode="light"
          onOpenExcalidraw={() => undefined}
          onOpenRelativeMarkdownLink={() => undefined}
          onOpenExternalLink={onOpenExternalLink}
        />,
      );
    });

    const link = container.querySelector<HTMLAnchorElement>("a");
    if (!link) throw new Error("External Markdown link not found");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });

    act(() => link.dispatchEvent(click));

    expect(click.defaultPrevented).toBe(true);
    expect(onOpenExternalLink).toHaveBeenCalledWith(
      "https://github.com/KeithCCC/rust-whiteboard",
    );
  });
});
