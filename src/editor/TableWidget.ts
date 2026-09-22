import { EditorView, WidgetType } from "@codemirror/view";
import { deleteTableColumn, deleteTableRow, insertTableColumnAfter, insertTableRowAfter, setTableCellAlignment } from "../tableMarkdown";
import { tableRuntime, type TableEntry } from "./tableEditingState";
import { tableEditingUi } from "./tableEditingUi";

const refreshToolbars = new WeakMap<HTMLElement, () => void>();
const popupCleanup = new WeakMap<HTMLElement, () => void>();

export class TableWidget extends WidgetType {
  constructor(readonly entry: TableEntry, readonly language: "ja" | "en", readonly readOnly: boolean) { super(); }
  eq(other: TableWidget) {
    return this.entry.id === other.entry.id && this.entry.raw === other.entry.raw && this.entry.source === other.entry.source
      && this.readOnly === other.readOnly && this.language === other.language;
  }
  ignoreEvent() { return true; }
  destroy(dom: HTMLElement) { popupCleanup.get(dom)?.(); }
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
      area.parentElement!.style.textAlign = this.cellAlignment(table, row, column);
    });
    refreshToolbars.get(dom)?.();
    return true;
  }
  private cellAlignment(table: NonNullable<TableEntry["table"]>, row: number, column: number) {
    const alignment = (row === 0 ? table.headers : table.rows[row - 1].cells)[column].alignment ?? table.alignments[column];
    return alignment === "none" ? "" : alignment;
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
    let selected = runtime.active?.address.tableId === entry.id
      ? { ...runtime.active.address } : { tableId: entry.id, row: 0, column: 0 };
    const popup = document.createElement("div");
    popup.className = "koharu-table-popup"; popup.hidden = true;
    popup.setAttribute("role", "menu"); popup.setAttribute("aria-label", ui.actions);
    let opener: HTMLButtonElement | null = null;
    const closeMenus = () => {
      popup.hidden = true;
      opener?.setAttribute("aria-expanded", "false");
    };
    const closeOnScroll = (event: Event) => {
      if (!popup.contains(event.target as Node)) closeMenus();
    };
    const closeOnPointer = (event: Event) => {
      if (!wrapper.contains(event.target as Node)) closeMenus();
    };
    document.addEventListener("scroll", closeOnScroll, true);
    document.addEventListener("pointerdown", closeOnPointer, true);
    window.addEventListener("resize", closeMenus);
    popupCleanup.set(wrapper, () => {
      document.removeEventListener("scroll", closeOnScroll, true);
      document.removeEventListener("pointerdown", closeOnPointer, true);
      window.removeEventListener("resize", closeMenus);
    });
    const mutate = (transform: Parameters<typeof runtime.changeTable>[1]) => {
      closeMenus(); runtime.changeTable(entry.id, transform, selected); runtime.focus(selected);
    };
    const group = (label: string, controls: HTMLButtonElement[]) => {
      const title = document.createElement("div"); title.className = "koharu-table-popup-heading"; title.textContent = label;
      popup.append(title, ...controls);
    };
    group(ui.row, [
      button(ui.addRow, () => mutate(t => insertTableRowAfter(t, selected.row - 1)), "addRow"),
      button(ui.deleteRow, () => mutate(t => deleteTableRow(t, selected.row - 1)), "deleteRow"),
    ]);
    group(ui.column, [
      button(ui.addColumn, () => mutate(t => insertTableColumnAfter(t, selected.column)), "addColumn"),
      button(ui.deleteColumn, () => mutate(t => deleteTableColumn(t, selected.column)), "deleteColumn"),
    ]);
    group(ui.alignment, (["left", "center", "right"] as const).map(alignment => {
      const control = button(ui[alignment], () => mutate(t => setTableCellAlignment(t, selected.row, selected.column, alignment)), "align");
      control.dataset.alignment = alignment; return control;
    }));
    popup.append(
      button(ui.source, () => { closeMenus(); runtime.toggleSource(entry.id, true); }),
      button(ui.exit, () => { closeMenus(); runtime.leave(entry.id); }),
    );
    popup.querySelectorAll("button").forEach(control => control.setAttribute("role", "menuitem"));
    const refreshToolbar = () => {
      const current = runtime.entry(entry.id)?.table ?? model;
      selected.row = Math.min(selected.row, current.rows.length);
      selected.column = Math.min(selected.column, current.headers.length - 1);
      const cell = (selected.row === 0 ? current.headers : current.rows[selected.row - 1].cells)[selected.column];
      popup.querySelectorAll<HTMLButtonElement>("button[data-mutation]").forEach(control => {
        control.disabled = view.state.readOnly
          || control.dataset.mutation === "deleteRow" && selected.row === 0
          || control.dataset.mutation === "deleteColumn" && current.headers.length === 1;
        if (control.dataset.alignment) {
          control.setAttribute("role", "menuitemradio");
          control.setAttribute("aria-checked", String((cell.alignment ?? current.alignments[selected.column]) === control.dataset.alignment));
        }
      });
      wrapper.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(area => {
        const [row, column] = area.dataset.tableCell!.split(":").map(Number);
        area.parentElement!.classList.toggle("is-selected-row", row === selected.row);
        area.parentElement!.classList.toggle("is-selected-column", column === selected.column);
      });
    };
    popup.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); closeMenus(); runtime.focus(selected); return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const items = Array.from(popup.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const current = items.indexOf(event.target as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    });
    refreshToolbars.set(wrapper, refreshToolbar);
    wrapper.addEventListener("focusout", event => {
      if (!(event.relatedTarget instanceof Node) || !wrapper.contains(event.relatedTarget)) closeMenus();
    });
    wrapper.append(popup);
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
        td.style.textAlign = this.cellAlignment(model, row, column);
        const area = document.createElement("textarea"); area.value = cell.text;
        area.dataset.tableCell = `${row}:${column}`; area.className = "koharu-table-cell";
        area.setAttribute("aria-label", ui.cell(row, column)); area.readOnly = this.readOnly;
        area.setAttribute("aria-keyshortcuts", "Alt+ArrowDown");
        area.rows = Math.max(1, cell.text.split("\n").length);
        area.addEventListener("focus", () => { selected = { ...address }; closeMenus(); runtime.activate(address, area); refreshToolbar(); });
        area.addEventListener("select", () => { if (runtime.active?.input === area) runtime.notify(); });
        area.addEventListener("input", () => { runtime.commit(address, area); this.resize(area, view); });
        area.addEventListener("compositionstart", () => runtime.beginComposition(address, area));
        area.addEventListener("compositionend", () => { runtime.endComposition(address, area); this.resize(area, view); });
        area.addEventListener("keydown", event => runtime.key(address, area, event));
        const trigger = button(ui.more, () => {
          const wasOpen = !popup.hidden && opener === trigger;
          closeMenus(); selected = { ...address }; opener = trigger; refreshToolbar();
          if (wasOpen) return;
          popup.hidden = false; trigger.setAttribute("aria-expanded", "true");
          const anchor = trigger.getBoundingClientRect();
          const bounds = popup.getBoundingClientRect();
          popup.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - bounds.width - 8))}px`;
          popup.style.top = `${Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - bounds.height - 8))}px`;
          popup.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
        });
        trigger.className = "koharu-table-cell-menu";
        trigger.setAttribute("aria-label", `${ui.cell(row, column)}: ${ui.actions}`);
        trigger.setAttribute("aria-haspopup", "menu"); trigger.setAttribute("aria-expanded", "false");
        td.append(area, trigger);
        tr.append(td);
      });
      (row === 0 ? head : body).append(tr);
    });
    table.append(head, body); scroll.append(table); wrapper.append(scroll);
    refreshToolbar();
    // Measure after insertion (CodeMirror executes writes outside its update phase).
    wrapper.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(area => this.resize(area, view));
    return wrapper;
  }
}
