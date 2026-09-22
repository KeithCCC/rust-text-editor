import { Annotation, EditorSelection, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { isolateHistory, redo, undo } from "@codemirror/commands";
import { createTableCellChange, insertTableRowAfter, serializeMarkdownTable, type MarkdownTable } from "../tableMarkdown";
import { detectFormattingContext, formatMarkdownSelection, isInlineMarkdownCommand, type FormatResult, type FormattingPlaceholders, type MarkdownCommand } from "../markdownFormatting";

export type TableCellAddress = { tableId: string; row: number; column: number };
export type TableEditingContext = { activeCell: TableCellAddress | null; composing: boolean };
export type TableEntry = { id: string; from: number; to: number; table: MarkdownTable | null; source: boolean; raw: string };
export const tableInput = Annotation.define<boolean>();

const runtimes = new WeakMap<EditorView, TableEditingRuntime>();
export function tableRuntime(view: EditorView) {
  let runtime = runtimes.get(view);
  if (!runtime) { runtime = new TableEditingRuntime(view); runtimes.set(view, runtime); }
  return runtime;
}

/** DOM input session. Persisted text always goes through the CodeMirror document. */
export class TableEditingRuntime {
  active: { address: TableCellAddress; input: HTMLTextAreaElement } | null = null;
  composing = false;
  inputDispatching = false;
  destroyed = false;
  getEntries: () => readonly TableEntry[] = () => [];
  toggleSource: (id: string, source: boolean) => void = () => {};
  onContextChange: (context: TableEditingContext) => void = () => {};
  private pending: Array<(ready: boolean) => void> = [];
  private historyCell = "";
  private draft: { key: string; from: number; to: number; raw: string; text: string } | null = null;
  constructor(readonly view: EditorView) {}
  notify() { this.onContextChange({ activeCell: this.active?.address ?? null, composing: this.composing }); }
  entry(id: string) { return this.getEntries().find(entry => entry.id === id); }
  activate(address: TableCellAddress, input: HTMLTextAreaElement) {
    if (this.active?.input !== input) this.draft = null;
    this.active = { address, input }; this.notify();
  }
  clear() { this.active = null; this.draft = null; this.historyCell = ""; this.notify(); }
  resetDraft() { this.draft = null; }
  beginComposition(address: TableCellAddress, input: HTMLTextAreaElement) {
    this.activate(address, input); this.composing = true; this.notify();
  }
  endComposition(address: TableCellAddress, input: HTMLTextAreaElement) {
    if (this.destroyed) return;
    this.composing = false; this.commit(address, input); this.notify();
    this.pending.splice(0).forEach(resolve => resolve(true));
  }
  prepare(): Promise<boolean> {
    if (this.destroyed) return Promise.resolve(false);
    if (this.composing) return new Promise(resolve => this.pending.push(resolve));
    if (this.active) this.commit(this.active.address, this.active.input);
    return Promise.resolve(true);
  }
  destroy() {
    this.destroyed = true;
    this.composing = false;
    this.pending.splice(0).forEach(resolve => resolve(false));
    this.active = null;
  }
  commit(address: TableCellAddress, input: HTMLTextAreaElement, isolate = false) {
    if (this.destroyed || this.composing || this.view.state.readOnly || !input.isConnected) return;
    const entry = this.entry(address.tableId);
    if (!entry?.table || entry.source) return;
    const key = `${address.tableId}:${address.row}:${address.column}`;
    const source = this.view.state.doc.toString();
    let table = entry.table;
    // Markdown padding is trimmed by the parser. Keep the last written payload
    // boundary while this cell is active, so typing "word " neither erases the
    // space nor accumulates it as padding on the next keystroke.
    if (this.draft?.key === key && source.slice(this.draft.from, this.draft.to) === this.draft.raw) {
      const replacement = { text: this.draft.text, range: { from: this.draft.from, to: this.draft.to, raw: this.draft.raw } };
      table = { ...table, headers: [...table.headers], rows: table.rows.map(row => ({ cells: [...row.cells] })) };
      (address.row === 0 ? table.headers : table.rows[address.row - 1].cells)[address.column] = replacement;
    }
    const change = createTableCellChange(source, table, address.row, address.column, input.value);
    if (!change) return;
    const separate = key !== this.historyCell;
    this.historyCell = isolate ? "" : key;
    const target = (address.row === 0 ? table.headers : table.rows[address.row - 1].cells)[address.column];
    this.draft = change.from === target.range?.from && change.to === target.range.to
      ? { key, from: change.from, to: change.from + change.insert.length, raw: change.insert, text: input.value } : null;
    this.inputDispatching = true;
    try {
      this.view.dispatch({ changes: change, annotations: [
        tableInput.of(true), Transaction.userEvent.of("input.type"), ...(isolate || separate ? [isolateHistory.of(isolate ? "full" : "before")] : []),
      ] });
    } finally { this.inputDispatching = false; }
  }
  focus(address: TableCellAddress) {
    const entry = this.entry(address.tableId);
    if (!entry?.table || entry.source) { this.clear(); this.view.focus(); return; }
    const row = Math.max(0, Math.min(address.row, entry.table.rows.length));
    const column = Math.max(0, Math.min(address.column, entry.table.headers.length - 1));
    const wrapper = Array.from(this.view.dom.querySelectorAll<HTMLElement>(".koharu-table-wrap")).find(el => el.dataset.tableId === address.tableId);
    const input = wrapper?.querySelector<HTMLTextAreaElement>(`[data-table-cell="${row}:${column}"]`);
    input?.focus(); input?.select();
  }
  changeTable(id: string, transform: (table: MarkdownTable) => MarkdownTable, target?: TableCellAddress) {
    if (this.view.state.readOnly || this.composing || this.destroyed) return;
    const entry = this.entry(id);
    if (!entry?.table || entry.source) return;
    const next = transform(entry.table);
    const insert = serializeMarkdownTable(next);
    if (insert === entry.raw) return;
    this.historyCell = "";
    this.draft = null;
    this.view.dispatch({ changes: { from: entry.from, to: entry.to, insert }, annotations: [tableInput.of(true), isolateHistory.of("full")] });
    const updated = this.entry(id);
    if (updated?.table) {
      this.focus({ tableId: id, row: Math.min(target?.row ?? 0, updated.table.rows.length), column: Math.min(target?.column ?? 0, updated.table.headers.length - 1) });
    }
  }
  leave(id: string, before = false) {
    if (this.composing) return;
    const entry = this.entry(id); if (!entry) return;
    let position = before ? entry.from : entry.to;
    if (!this.view.state.readOnly && (before ? position === 0 : position === this.view.state.doc.length)) {
      this.view.dispatch({ changes: { from: position, insert: "\n\n" },
        selection: EditorSelection.single(before ? 0 : position + 2), annotations: [tableInput.of(true), isolateHistory.of("full")] });
    } else {
      position = before ? Math.max(0, position - 1) : Math.min(this.view.state.doc.length, position + 1);
      this.view.dispatch({ selection: EditorSelection.single(position), annotations: tableInput.of(true) });
    }
    this.clear(); this.view.focus();
  }
  key(address: TableCellAddress, input: HTMLTextAreaElement, event: KeyboardEvent) {
    if (this.composing || event.isComposing || event.keyCode === 229) return;
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault(); event.stopPropagation();
      input.parentElement?.querySelector<HTMLButtonElement>(".koharu-table-cell-menu")?.click();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopPropagation();
      if (this.view.state.readOnly) return;
      (event.key.toLowerCase() === "y" || event.shiftKey ? redo : undo)(this.view);
      this.focus(address); return;
    }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.leave(address.tableId); return; }
    if (this.view.state.readOnly) return;
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault(); event.stopPropagation();
      input.setRangeText("\n", input.selectionStart, input.selectionEnd, "end");
      this.commit(address, input); return;
    }
    if (event.key !== "Tab" && event.key !== "Enter") return;
    event.preventDefault(); event.stopPropagation();
    this.commit(address, input);
    const entry = this.entry(address.tableId); if (!entry?.table) return;
    const count = entry.table.headers.length;
    const index = event.key === "Enter" ? (address.row + 1) * count + address.column
      : address.row * count + address.column + (event.shiftKey ? -1 : 1);
    if (index < 0) { this.leave(entry.id, true); return; }
    const target = { tableId: entry.id, row: Math.floor(index / count), column: index % count };
    if (target.row > entry.table.rows.length) {
      this.changeTable(entry.id, table => insertTableRowAfter(table, table.rows.length - 1), target);
    } else this.focus(target);
  }
  formattingContext() {
    if (!this.active) return null;
    const { input } = this.active;
    return { ...detectFormattingContext(input.value, { from: input.selectionStart, to: input.selectionEnd }), tableCell: true };
  }
  format(command: MarkdownCommand, placeholders: FormattingPlaceholders): FormatResult | undefined {
    if (!this.active || this.composing || this.view.state.readOnly || !isInlineMarkdownCommand(command)) return;
    const { input, address } = this.active;
    const change = formatMarkdownSelection(input.value, { from: input.selectionStart, to: input.selectionEnd }, command, placeholders);
    if (change.warning) return change;
    input.value = input.value.slice(0, change.from) + change.insert + input.value.slice(change.to);
    this.commit(address, input, true); input.focus();
    input.setSelectionRange(change.from + change.selectionStart, change.from + change.selectionEnd); this.notify();
    return change;
  }
  wrap(before: string, after: string, placeholder: string) {
    if (!this.active || this.composing || this.view.state.readOnly) return;
    const { input, address } = this.active;
    const start = input.selectionStart;
    const selected = input.value.slice(start, input.selectionEnd);
    input.setRangeText(before + (selected || placeholder) + after, start, input.selectionEnd, "select");
    this.commit(address, input, true); input.focus(); this.notify();
  }
}
