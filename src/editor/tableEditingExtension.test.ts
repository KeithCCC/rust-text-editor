// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { history, undo, redo } from "@codemirror/commands";
import { tableEditingExtension, prepareTableEditing, revealTableSelection } from "./tableEditingExtension";

let views: EditorView[] = [];
const raw = "| A | B |\n| --- | --- |\n| x | y |";
function mount(doc = raw, readOnly = false) {
  const parent = document.body.appendChild(document.createElement("div"));
  const view = new EditorView({ parent, state: EditorState.create({ doc, extensions: [
    markdown({ base: markdownLanguage }), history(), EditorState.readOnly.of(readOnly),
    tableEditingExtension({ language: "en", onContextChange: () => {} }),
  ] }) });
  views.push(view);
  return view;
}
function cell(view: EditorView, row = 1, column = 0, table = 0) {
  const wrapper = view.dom.querySelectorAll(".koharu-table-wrap")[table];
  const result = wrapper?.querySelector<HTMLTextAreaElement>(`[data-table-cell="${row}:${column}"]`);
  if (!result) throw new Error("Cell not found");
  return result;
}
function input(area: HTMLTextAreaElement, value: string) {
  area.focus(); area.value = value;
  area.dispatchEvent(new Event("input", { bubbles: true }));
}
function key(area: HTMLElement, key: string, options: KeyboardEventInit = {}) {
  area.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
}
function button(view: EditorView, label: string) {
  const target = Array.from(view.dom.querySelectorAll("button")).find(b => b.textContent === label);
  if (!target) throw new Error(`Missing button ${label}`);
  return target;
}
beforeEach(() => {
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
});
afterEach(() => { views.forEach(v => v.destroy()); views = []; document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("direct table editing", () => {
  it("opens a popup at each cell and keeps it open while focus moves between commands", async () => {
    const view = mount(); cell(view, 1, 1).focus();
    expect(view.dom.querySelectorAll(".koharu-table-cell-menu")).toHaveLength(4);
    expect(view.dom.querySelector(".koharu-table-toolbar")).toBeNull();
    cell(view, 1, 1).parentElement!.querySelector("button")!.click();
    const menu = view.dom.querySelector<HTMLElement>(".koharu-table-popup")!;
    const first = menu.querySelector("button")!, remove = button(view, "Delete column");
    const active = vi.spyOn(document, "activeElement", "get").mockReturnValue(document.body);
    first.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: remove }));
    await Promise.resolve(); active.mockRestore();
    expect(menu.hidden).toBe(false);
    remove.focus(); remove.click();
    expect(view.dom.querySelectorAll("th")).toHaveLength(1);
    expect(cell(view).value).toBe("x");
  });
  it("targets the clicked cell in another table, including when it was not focused", () => {
    const view = mount(raw + "\n\n" + raw);
    cell(view, 1, 1, 1).parentElement!.querySelector("button")!.click();
    const wrapper = view.dom.querySelectorAll<HTMLElement>(".koharu-table-wrap")[1];
    const remove = Array.from(wrapper.querySelectorAll("button")).find(b => b.textContent === "Delete column")!;
    remove.click();
    expect(view.state.doc.toString().split("\n\n")[0]).toBe(raw);
    expect(cell(view, 1, 0, 1).value).toBe("x");
    expect(view.dom.querySelectorAll("table")[1].querySelectorAll("th")).toHaveLength(1);
  });
  it("disables header deletion and closes the popup with Escape", () => {
    const view = mount(); cell(view, 0, 1).parentElement!.querySelector("button")!.click();
    expect(button(view, "Delete row").disabled).toBe(true);
    cell(view, 1, 1).parentElement!.querySelector("button")!.click();
    expect(button(view, "Delete row").disabled).toBe(false);
    const menu = view.dom.querySelector<HTMLElement>(".koharu-table-popup")!;
    key(button(view, "Delete row"), "Escape");
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(cell(view, 1, 1));
  });
  it("renders one-column and multiple tables after headings", () => {
    const view = mount("# Heading\n\n| 方針 |\n| --- |\n| 内容 |\n\n" + raw);
    expect(view.dom.querySelectorAll("table")).toHaveLength(2);
    expect(cell(view).value).toBe("内容");
  });
  it("leaves fenced, quoted and list-nested tables as source", () => {
    const view = mount("```md\n" + raw + "\n```\n\n" + raw.split("\n").map(s => "> " + s).join("\n") + "\n\n- item\n\n" + raw.split("\n").map(s => "  " + s).join("\n"));
    expect(view.dom.querySelector("table")).toBeNull();
  });
  it("updates the document without blur and retains the active textarea", () => {
    const view = mount(); const area = cell(view);
    input(area, "日本語");
    expect(view.state.doc.toString()).toContain("| 日本語 | y |");
    expect(cell(view)).toBe(area); expect(document.activeElement).toBe(area);
    input(area, "日本語追記");
    expect(view.state.doc.toString()).toContain("日本語追記");
  });
  it("keeps table identity after text is inserted before it", () => {
    const view = mount("intro\n\n" + raw + "\n\n" + raw);
    view.dispatch({ changes: { from: 0, insert: "prefix\n" } });
    input(cell(view, 1, 0, 1), "second");
    expect(view.state.doc.toString()).toBe("prefix\nintro\n\n" + raw + "\n\n" + raw.replace("| x |", "| second |"));
  });
  it("navigates within the second table and appends a row with Tab", () => {
    const view = mount(raw + "\n\n" + raw);
    const area = cell(view, 1, 0, 1); input(area, "second"); key(area, "Tab");
    expect(document.activeElement).toBe(cell(view, 1, 1, 1));
    key(cell(view, 1, 1, 1), "Tab");
    expect(document.activeElement).toBe(cell(view, 2, 0, 1));
    expect(view.dom.querySelectorAll("tbody tr")).toHaveLength(3);
  });
  it("uses Enter for row movement, Shift+Enter for a newline, Escape to leave", () => {
    const view = mount(); const area = cell(view); area.focus();
    key(area, "Enter", { shiftKey: true });
    expect(view.state.doc.toString()).toContain("<br>");
    key(area, "Enter"); expect(document.activeElement).toBe(cell(view, 2));
    input(cell(view, 2), "kept"); key(cell(view, 2), "Escape");
    expect(view.state.doc.toString()).toContain("kept"); expect(view.hasFocus).toBe(true);
  });
  it("waits for composition before preparing a save and ignores IME Enter", async () => {
    const view = mount(); const area = cell(view); area.focus();
    area.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input(area, "変換中"); key(area, "Enter", { isComposing: true });
    let settled = false; const prepared = prepareTableEditing(view).then(value => { settled = true; return value; });
    await Promise.resolve(); expect(settled).toBe(false); expect(cell(view)).toBe(area);
    area.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    expect(await prepared).toBe(true); expect(view.state.doc.toString()).toContain("変換中");
    expect(view.dom.querySelectorAll("tbody tr")).toHaveLength(1);
  });
  it("cancels pending preparation when the editor is destroyed", async () => {
    const view = mount(); cell(view).dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const prepared = prepareTableEditing(view); view.destroy(); views = [];
    expect(await prepared).toBe(false);
  });
  it("routes textarea undo to document history", () => {
    const view = mount(); input(cell(view), "changed"); key(cell(view), "z", { ctrlKey: true });
    expect(view.state.doc.toString()).toBe(raw);
    key(cell(view), "y", { ctrlKey: true }); expect(view.state.doc.toString()).toContain("changed");
    button(view, "Add row below").click(); expect(view.dom.querySelectorAll("tbody tr")).toHaveLength(2);
    undo(view); expect(view.dom.querySelectorAll("tbody tr")).toHaveLength(1);
    redo(view); expect(view.dom.querySelectorAll("tbody tr")).toHaveLength(2);
  });
  it("honors readOnly for cells and structural controls", () => {
    const view = mount(raw, true); expect(cell(view).readOnly).toBe(true);
    expect(button(view, "Add row below").disabled).toBe(true);
    input(cell(view), "forbidden"); button(view, "Add row below").click();
    expect(view.state.doc.toString()).toBe(raw);
  });
  it("switches to source and back without altering data", () => {
    const view = mount(); button(view, "Edit source").click();
    expect(view.dom.querySelector("table")).toBeNull();
    button(view, "Show table").click(); expect(cell(view).value).toBe("x");
    expect(view.state.doc.toString()).toBe(raw);
  });
  it("reveals search selections within the table", () => {
    const view = mount(); const start = raw.indexOf("x");
    revealTableSelection(view, start, start + 1);
    expect(view.dom.querySelector("table")).toBeNull();
    expect(view.state.selection.main.from).toBe(start);
  });
  it("retains an invalid source table and lets it recover without data loss", () => {
    const view = mount(); button(view, "Edit source").click();
    const divider = view.state.doc.toString().indexOf("---");
    view.dispatch({ changes: { from: divider, to: divider + 3, insert: "oops" } });
    expect(button(view, "Show table").disabled).toBe(true);
    expect(view.state.doc.toString()).toContain("oops");
    view.dispatch({ changes: { from: divider, to: divider + 4, insert: "---" } });
    button(view, "Show table").click();
    expect(cell(view).value).toBe("x"); expect(view.state.doc.toString()).toBe(raw);
  });
  it("deletes columns and changes alignment without losing other cells", () => {
    const view = mount(); button(view, "Align right").click();
    expect(view.state.doc.toString()).toContain("<!--koharu:align=right-->A");
    expect(cell(view, 0, 0).parentElement!.style.textAlign).toBe("right");
    expect(cell(view, 1, 0).parentElement!.style.textAlign).toBe("");
    button(view, "Delete column").click();
    expect(cell(view).value).toBe("y");
    expect(button(view, "Delete column").disabled).toBe(true);
  });
  it("keeps the document unchanged on a no-op input", () => {
    const view = mount(); const state = view.state; input(cell(view), "x");
    expect(view.state).toBe(state);
  });
  it("allows Shift+Tab to leave the first cell without corrupting the table", () => {
    const view = mount(); const header = cell(view, 0); header.focus(); key(header, "Tab", { shiftKey: true });
    expect(view.state.doc.toString()).toBe("\n\n" + raw);
    expect(view.state.selection.main.head).toBe(0);
    expect(view.hasFocus).toBe(true);
  });
  it("does not rebuild another table's DOM when one cell changes", () => {
    const view = mount(raw + "\n\n" + raw); const second = cell(view, 1, 0, 1);
    input(cell(view), "first changed"); expect(cell(view, 1, 0, 1)).toBe(second);
  });
  it("continues editing after the extension is reconfigured for another language", () => {
    const view = mount();
    view.dispatch({ effects: StateEffect.reconfigure.of([markdown({ base: markdownLanguage }), history(),
      tableEditingExtension({ language: "ja", onContextChange: () => {} })]) });
    input(cell(view), "切替後");
    expect(view.state.doc.toString()).toContain("切替後");
  });
  it("retains a trailing space while typing the next word without accumulating padding", () => {
    const view = mount(); const area = cell(view);
    input(area, "two "); expect(area.value).toBe("two ");
    input(area, "two words");
    expect(view.state.doc.toString()).toBe(raw.replace("| x |", "| two words |"));
    input(area, "two words "); expect(area.value).toBe("two words ");
    input(area, "two words again");
    expect(view.state.doc.toString()).toBe(raw.replace("| x |", "| two words again |"));
  });
  it.each(["insert", "delete"])("keeps source mode when editing its first delimiter (%s)", action => {
    const view = mount(action === "insert" ? "A | B\n--- | ---\nx | y" : raw);
    button(view, "Edit source").click();
    view.dispatch({ changes: action === "insert" ? { from: 0, insert: "X" } : { from: 0, to: 1 } });
    expect(view.dom.querySelector("table")).toBeNull();
    expect(view.dom.querySelectorAll(".koharu-table-source-controls")).toHaveLength(1);
    button(view, "Show table").click(); expect(view.dom.querySelector("table")).not.toBeNull();
  });
  it("opens cell actions with Alt+Down and returns to the cell with Escape", () => {
    const view = mount(); const area = cell(view); area.focus();
    key(area, "ArrowDown", { altKey: true });
    const menu = view.dom.querySelector<HTMLElement>(".koharu-table-popup")!;
    expect(menu.hidden).toBe(false);
    expect(document.activeElement).toBe(menu.querySelector("button"));
    key(document.activeElement as HTMLElement, "Escape");
    expect(document.activeElement).toBe(area);
  });
  it.each([0, 1])("keeps a borderless table editable when clearing boundary column %s", column => {
    const view = mount("A | B\n--- | ---\nx | y"); const area = cell(view, 1, column);
    input(area, ""); expect(cell(view, 1, column)).toBe(area);
    input(area, "next "); expect(area.value).toBe("next ");
    input(area, "next word"); expect(area.value).toBe("next word");
    expect(cell(view, 1, column === 0 ? 1 : 0).value).toBe(column === 0 ? "y" : "x");
  });
  it("keeps keyboard undo and redo reachable after the focused row is removed", () => {
    const view = mount(); cell(view, 1, 1).focus(); key(cell(view, 1, 1), "Tab");
    key(cell(view, 2, 0), "z", { ctrlKey: true });
    expect(document.activeElement).toBe(cell(view, 1, 0));
    key(document.activeElement as HTMLElement, "y", { ctrlKey: true });
    expect(view.dom.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});
