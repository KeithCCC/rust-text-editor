// @vitest-environment jsdom

import { undo, undoDepth } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFormattingUi } from "../formattingUi";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";

let container: HTMLDivElement;
let root: Root;

function renderEditor(value: string) {
  const editorRef = createRef<MarkdownEditorHandle>();
  const onChange = vi.fn();
  act(() => {
    root.render(
      <MarkdownEditor
        ref={editorRef}
        value={value}
        mode="source"
        themeMode="light"
        placeholder={getFormattingUi("en").placeholders.editor}
        onChange={onChange}
        onFormattingContextChange={() => undefined}
      />,
    );
  });
  const editorElement = container.querySelector<HTMLElement>(".cm-editor");
  if (!editorElement) throw new Error("CodeMirror editor did not mount");
  const view = EditorView.findFromDOM(editorElement);
  if (!view) throw new Error("CodeMirror view was not found");
  return { editorRef, onChange, view };
}

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
  it.each([
    {
      label: "whitespace-only bold",
      value: "   ",
      selection: { from: 0, to: 3 },
      command: { kind: "bold" } as const,
      insert: "   ",
    },
    {
      label: "block-interrupting bold",
      value: "one\n# two",
      selection: { from: 0, to: 9 },
      command: { kind: "bold" } as const,
      insert: "one\n# two",
    },
    {
      label: "crossing-run bold",
      value: "*a **b* c**",
      selection: { from: 5, to: 9 },
      command: { kind: "bold" } as const,
      insert: "b* c",
    },
  ])("does not dispatch a $label identity result into document history", ({
    value,
    selection,
    command,
    insert,
  }) => {
    const { editorRef, onChange, view } = renderEditor(value);
    act(() => editorRef.current?.selectRange(selection.from, selection.to));
    onChange.mockClear();
    const dispatch = vi.spyOn(view, "dispatch");

    let result: ReturnType<MarkdownEditorHandle["applyFormat"]> = undefined;
    act(() => {
      result = editorRef.current?.applyFormat(command, getFormattingUi("en").placeholders);
    });

    const dispatchCountAfterFormat = dispatch.mock.calls.length;
    const onChangeCountAfterFormat = onChange.mock.calls.length;
    const historyDepthAfterFormat = undoDepth(view.state);
    let didUndo = false;
    act(() => {
      didUndo = undo(view);
    });

    expect(result).toEqual({
      ...selection,
      insert,
      selectionStart: 0,
      selectionEnd: insert.length,
    });
    expect.soft(dispatchCountAfterFormat).toBe(0);
    expect.soft(onChangeCountAfterFormat).toBe(0);
    expect.soft(historyDepthAfterFormat).toBe(0);
    expect.soft(didUndo).toBe(false);
    expect.soft(dispatch).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe(value);
  });

  it("still dispatches delimiter removal when the full change range is not an identity", () => {
    const value = "**Koharu**";
    const { editorRef, onChange, view } = renderEditor(value);
    act(() => editorRef.current?.selectRange(2, 8));
    onChange.mockClear();
    const dispatch = vi.spyOn(view, "dispatch");

    let result: ReturnType<MarkdownEditorHandle["applyFormat"]> = undefined;
    act(() => {
      result = editorRef.current?.applyFormat({ kind: "bold" }, getFormattingUi("en").placeholders);
    });

    expect(result).toMatchObject({ from: 0, to: 10, insert: "Koharu" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("Koharu", expect.anything());
    expect(view.state.doc.toString()).toBe("Koharu");
    expect(undoDepth(view.state)).toBe(1);
  });

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
