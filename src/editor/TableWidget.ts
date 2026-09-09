import { EditorView, WidgetType } from "@codemirror/view";
import { deleteTableColumn, deleteTableRow, insertTableColumnAfter, insertTableRowAfter, setTableColumnAlignment } from "../tableMarkdown";
import { tableRuntime, type TableEntry } from "./tableEditingState";
import { tableEditingUi } from "./tableEditingUi";

export class TableWidget extends WidgetType {
  constructor(readonly entry: TableEntry, readonly language: "ja" | "en", readonly readOnly: boolean) { super(); }
  eq(other: TableWidget) {
    return this.entry.id === other.entry.id && this.entry.raw === other.entry.raw && this.entry.source === other.entry.source
      && this.readOnly === other.readOnly && this.language === other.language;
  }
  ignoreEvent() { return true; }
  updateDOM(dom: HTMLElement, view: EditorView) {
    if (dom.dataset.tableId !== this.entry.id || dom.dataset.source !== String(this.entry.source)
      || dom.dataset.language !== this.language) return false;
    if (this.entry.source) {
      const button = dom.querySelector("button");
      if (button) { button.disabled = !this.entry.table; button.title = this.entry.table ? "" : tableEditingUi(this.language).invalid; }
      return true;
    }
    const table = this.entry.table; if (!table) return false;
    const editors = dom.querySelectorAll<HTMLTextAreaElement>("textarea");
    if (dom.dataset.columns !== String(table.headers.length) || editors.length !== table.headers.length * (table.rows.length + 1)) return false;
    const runtime = tableRuntime(view);
    editors.forEach(area => {
      const [row, column] = area.dataset.tableCell!.split(":").map(Number);
      const value = (row === 0 ? table.headers : table.rows[row - 1].cells)[column].text;
      if (!((runtime.composing || runtime.inputDispatching) && runtime.active?.input === area) && area.value !== value) {
        const start = area.selectionStart, end = area.selectionEnd;
        area.value = value; area.setSelectionRange(Math.min(start, value.length), Math.min(end, value.length));
        this.resize(area, view);
      }
      area.readOnly = this.readOnly;
      area.parentElement!.style.textAlign = table.alignments[column] === "none" ? "" : table.alignments[column];
    });
    dom.querySelectorAll<HTMLButtonElement>("button[data-mutation]").forEach(button => {
      button.disabled = this.readOnly || button.dataset.mutation === "deleteColumn" && table.headers.length === 1;
    });
    return true;
  }
  private resize(area: HTMLTextAreaElement, view: EditorView) {
    area.rows = Math.max(1, area.value.split("\n").length);
    view.requestMeasure({ key: area, read: () => area.scrollHeight, write: height => {
      if (area.isConnected && height > 0) area.style.height = `${height}px`;
    } });
  }
  toDOM(view: EditorView) {
    const { entry } = this;
    const ui = tableEditingUi(this.language);
    const runtime = tableRuntime(view);
    const wrapper = document.createElement("div");
    wrapper.className = "koharu-table-wrap";
    wrapper.dataset.tableId = entry.id; wrapper.dataset.source = String(entry.source); wrapper.dataset.language = this.language;
    wrapper.contentEditable = "false";
    const button = (label: string, action: () => void, mutation?: string) => {
      const element = document.createElement("button"); element.type = "button"; element.textContent = label;
      if (mutation) { element.dataset.mutation = mutation; element.disabled = this.readOnly || mutation === "deleteColumn" && entry.table?.headers.length === 1; }
      element.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation();
        if (runtime.composing || mutation && view.state.readOnly) return;
        action();
      });
      return element;
    };
    if (entry.source) {
      wrapper.classList.add("koharu-table-source-controls");
      const show = button(ui.rendered, () => runtime.toggleSource(entry.id, false));
      show.disabled = !entry.table; show.title = entry.table ? "" : ui.invalid;
      wrapper.append(show); return wrapper;
    }
    const model = entry.table!;
    wrapper.dataset.columns = String(model.headers.length);
    const toolbar = document.createElement("div"); toolbar.className = "koharu-table-toolbar";
    toolbar.append(button(ui.source, () => runtime.toggleSource(entry.id, true)), button(ui.exit, () => runtime.leave(entry.id)));
    wrapper.append(toolbar);
    const scroll = document.createElement("div"); scroll.className = "koharu-table-scroll";
    const table = document.createElement("table"); table.className = "koharu-table";
    const head = document.createElement("thead"), body = document.createElement("tbody");
    const rows = [model.headers, ...model.rows.map(row => row.cells)];
    rows.forEach((cells, row) => {
      const tr = document.createElement("tr");
      cells.forEach((cell, column) => {
        const address = { tableId: entry.id, row, column };
        const td = document.createElement(row === 0 ? "th" : "td");
        if (row === 0) td.setAttribute("scope", "col");
        td.style.textAlign = model.alignments[column] === "none" ? "" : model.alignments[column];
        const area = document.createElement("textarea"); area.value = cell.text;
        area.dataset.tableCell = `${row}:${column}`; area.className = "koharu-table-cell";
        area.setAttribute("aria-label", ui.cell(row, column)); area.readOnly = this.readOnly;
        area.rows = Math.max(1, cell.text.split("\n").length);
        area.addEventListener("focus", () => runtime.activate(address, area));
        area.addEventListener("select", () => { if (runtime.active?.input === area) runtime.notify(); });
        area.addEventListener("input", () => { runtime.commit(address, area); this.resize(area, view); });
        area.addEventListener("compositionstart", () => runtime.beginComposition(address, area));
        area.addEventListener("compositionend", () => { runtime.endComposition(address, area); this.resize(area, view); });
        area.addEventListener("keydown", event => runtime.key(address, area, event));
        td.append(area);
        const menu = document.createElement("details"); menu.className = "koharu-table-actions";
        const summary = document.createElement("summary"); summary.textContent = "⋯"; summary.setAttribute("aria-label", `${ui.actions}: ${ui.cell(row, column)}`);
        const controls = document.createElement("div"); controls.className = "koharu-table-action-list";
        const mutate = (transform: Parameters<typeof runtime.changeTable>[1]) => { menu.open = false; runtime.changeTable(entry.id, transform, address); };
        controls.append(
          button(ui.addRow, () => mutate(t => insertTableRowAfter(t, row - 1)), "addRow"),
          button(ui.addColumn, () => mutate(t => insertTableColumnAfter(t, column)), "addColumn"),
          button(ui.deleteColumn, () => mutate(t => deleteTableColumn(t, column)), "deleteColumn"),
        );
        if (row > 0) controls.append(button(ui.deleteRow, () => mutate(t => deleteTableRow(t, row - 1)), "deleteRow"));
        for (const alignment of ["left", "center", "right"] as const) {
          controls.append(button(ui[alignment], () => mutate(t => setTableColumnAlignment(t, column, alignment)), "align"));
        }
        menu.addEventListener("keydown", event => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); menu.open = false; area.focus(); }
        });
        menu.append(summary, controls); td.append(menu); tr.append(td);
      });
      (row === 0 ? head : body).append(tr);
    });
    table.append(head, body); scroll.append(table); wrapper.append(scroll);
    // Measure after insertion (CodeMirror executes writes outside its update phase).
    wrapper.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(area => this.resize(area, view));
    return wrapper;
  }
}
