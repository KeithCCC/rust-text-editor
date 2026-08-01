// @vitest-environment jsdom

import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFormattingUi } from "../formattingUi";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  vi.restoreAllMocks();
});

describe("MarkdownEditor transaction safety", () => {
  it("returns a multiline inline-code warning without dispatching a document change", () => {
    const editorRef = createRef<MarkdownEditorHandle>();
    const onChange = vi.fn();
    act(() => {
      root.render(
        <MarkdownEditor
          ref={editorRef}
          value={"one\ntwo"}
          mode="source"
          themeMode="light"
          placeholder={getFormattingUi("en").placeholders.editor}
          onChange={onChange}
          onFormattingContextChange={() => undefined}
        />,
      );
    });
    act(() => editorRef.current?.selectRange(0, 7));
    onChange.mockClear();

    let result: ReturnType<MarkdownEditorHandle["applyFormat"]> = undefined;
    act(() => {
      result = editorRef.current?.applyFormat({ kind: "inlineCode" }, getFormattingUi("en").placeholders);
    });

    expect(result).toMatchObject({ warning: "multilineInlineCode" });
    expect(onChange).not.toHaveBeenCalled();
    expect(Array.from(container.querySelectorAll(".cm-line"))
      .map((line) => line.textContent)
      .join("\n")).toBe("one\ntwo");
  });
});
