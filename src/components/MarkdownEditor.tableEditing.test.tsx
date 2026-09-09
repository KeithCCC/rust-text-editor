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


describe("MarkdownEditor table integration", () => {
  const source = "intro\n\n| A | B |\n| --- | --- |\n| value | keep |";
  it("enables direct tables in source mode and formats the active cell", () => {
    const { editorRef, view } = renderEditor(source);
    const cell = container.querySelector<HTMLTextAreaElement>('[data-table-cell="1:0"]');
    expect(cell).not.toBeNull();
    act(() => { cell!.focus(); cell!.setSelectionRange(0, 5); editorRef.current!.applyFormat({ kind: "bold" }, getFormattingUi("en").placeholders); });
    expect(view.state.doc.toString()).toContain("| **value** | keep |");
    expect(view.state.doc.toString()).toMatch(/^intro/);
    act(() => editorRef.current!.applyFormat({ kind: "heading", level: 1 }, getFormattingUi("en").placeholders));
    expect(view.state.doc.toString()).toMatch(/^intro/);
  });
  it("makes search selections inside tables visible", () => {
    const { editorRef, view } = renderEditor(source);
    act(() => editorRef.current!.selectRange(source.indexOf("value"), source.indexOf("value") + 5));
    expect(view.dom.querySelector("table")).toBeNull();
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("value");
  });
});

it("inserts a new table directly into editable cells", () => {
  const { editorRef, view } = renderEditor("");
  act(() => editorRef.current!.applyFormat({ kind: "table" }, getFormattingUi("en").placeholders));
  expect(view.dom.querySelector("table")).not.toBeNull();
  expect(document.activeElement).toBe(view.dom.querySelector("textarea"));
});

it("undoes cell formatting separately from typed text", () => {
  const { editorRef, view } = renderEditor("| A |\n| --- |\n| x |");
  const cell = view.dom.querySelector<HTMLTextAreaElement>('[data-table-cell="1:0"]')!;
  act(() => { cell.focus(); cell.value="typed"; cell.dispatchEvent(new Event("input",{bubbles:true})); cell.select(); editorRef.current!.applyFormat({kind:"bold"},getFormattingUi("en").placeholders); });
  act(() => { undo(view); });
  expect(view.state.doc.toString()).toContain("| typed |");
});
