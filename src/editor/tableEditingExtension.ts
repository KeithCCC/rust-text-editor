import { EditorSelection, StateEffect, StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { parseMarkdownTable } from "../tableMarkdown";
import { TableWidget } from "./TableWidget";
import { tableInput, tableRuntime, type TableEditingContext, type TableEntry } from "./tableEditingState";

const showSource = StateEffect.define<{ id: string; source: boolean }>();
type Tables = { entries: TableEntry[] };
let nextId = 0;
function discover(state: EditorState, previous: TableEntry[]): TableEntry[] {
  const entries: TableEntry[] = [];
  let source: string | undefined;
  // Only document-level tables. Do not traverse nested lists, quotes or code.
  for (let node = syntaxTree(state).topNode.firstChild; node; node = node.nextSibling) {
    if (node.name !== "Table") continue;
    source ??= state.doc.toString();
    const prior = previous.find(entry => entry.from === node!.from)
      ?? previous.find(entry => entry.source && entry.from <= node!.from && entry.to >= node!.to);
    const raw = source.slice(node.from, node.to);
    const table = prior?.raw === raw && prior.table?.from === node.from ? prior.table : parseMarkdownTable(source, node.from, node.to);
    if (!table) continue;
    const id = prior && !entries.some(entry => entry.id === prior.id) ? prior.id : `table-${++nextId}`;
    entries.push({ id, from: node.from, to: node.to, table, source: prior?.source ?? false, raw });
  }
  // Keep a source-mode anchor even while its syntax is temporarily invalid.
  for (const prior of previous) {
    if (prior.source && !entries.some(entry => entry.id === prior.id) && prior.to > prior.from) {
      entries.push({ ...prior, table: null, raw: state.sliceDoc(prior.from, prior.to) });
    }
  }
  return entries.sort((a, b) => a.from - b.from);
}
function decorate(entries: TableEntry[], language: "ja" | "en", readOnly: boolean): DecorationSet {
  const ranges: Range<Decoration>[] = entries.map(entry => entry.source
    ? Decoration.widget({ widget: new TableWidget(entry, language, readOnly), block: true, side: -1 }).range(entry.from)
    : Decoration.replace({ widget: new TableWidget(entry, language, readOnly), block: true }).range(entry.from, entry.to));
  return Decoration.set(ranges, true);
}

// One field identity permits external selection and preparation commands to locate it.
const tableField = StateField.define<Tables>({
  create(state) { return { entries: discover(state, []) }; },
  update(value, tr) {
    let entries = value.entries;
    if (tr.docChanged || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
      const mapped = entries.map(entry => ({ ...entry, from: tr.changes.mapPos(entry.from, entry.source ? -1 : 1), to: tr.changes.mapPos(entry.to, entry.source ? 1 : -1) }));
      // Replacing a whole table maps its start to the replacement end with assoc=1.
      tr.changes.iterChangedRanges((fromA, toA, fromB) => {
        entries.forEach((entry, index) => { if (entry.from === fromA && toA > fromA) mapped[index].from = fromB; });
      });
      entries = discover(tr.state, mapped.filter(entry => entry.from <= entry.to));
    }
    for (const effect of tr.effects) if (effect.is(showSource)) {
      entries = entries.map(entry => entry.id === effect.value.id && (effect.value.source || entry.table)
        ? { ...entry, source: effect.value.source } : entry);
    }
    if (tr.selection && !tr.annotation(tableInput)) {
      entries = entries.map(entry => tr.state.selection.ranges.some(range =>
        range.empty ? range.from > entry.from && range.from < entry.to : range.from < entry.to && range.to > entry.from)
        ? { ...entry, source: true } : entry);
    }
    return entries === value.entries && tr.state.readOnly === tr.startState.readOnly ? value : { entries };
  },
});

export function tableEditingExtension(options: { language: "ja" | "en"; onContextChange: (context: TableEditingContext) => void }): Extension {
  const decorationField = StateField.define<DecorationSet>({
    create(state) { return decorate(state.field(tableField).entries, options.language, state.readOnly); },
    update(value, tr) {
      return tr.state.field(tableField) === tr.startState.field(tableField) ? value
        : decorate(tr.state.field(tableField).entries, options.language, tr.state.readOnly);
    },
    provide: field => EditorView.decorations.from(field),
  });
  return [tableField, decorationField, ViewPlugin.define(view => {
    const runtime = tableRuntime(view);
    runtime.destroyed = false;
    runtime.getEntries = () => view.state.field(tableField, false)?.entries ?? [];
    runtime.onContextChange = options.onContextChange;
    runtime.toggleSource = (id, source) => {
      if (runtime.composing) return;
      const entry = runtime.entry(id); if (!entry || !source && !entry.table) return;
      runtime.clear();
      view.dispatch({ effects: showSource.of({ id, source }), selection: EditorSelection.single(entry.from), annotations: tableInput.of(true) });
      if (source) view.focus(); else runtime.focus({ tableId: id, row: 0, column: 0 });
    };
    return {
      update(update) {
        if (update.docChanged && !runtime.inputDispatching) runtime.resetDraft();
      },
      destroy: () => runtime.destroy(),
    };
  }), EditorView.domEventHandlers({ focus(event, view) {
    if (event.target === view.contentDOM) tableRuntime(view).clear();
    return false;
  } })];
}
export function prepareTableEditing(view: EditorView) { return tableRuntime(view).prepare(); }
export function revealTableSelection(view: EditorView, from: number, to: number) {
  tableRuntime(view).clear();
  const effects = (view.state.field(tableField, false)?.entries ?? []).filter(entry => from <= entry.to && to >= entry.from)
    .map(entry => showSource.of({ id: entry.id, source: true }));
  view.dispatch({ selection: EditorSelection.single(from, to), effects: [...effects, EditorView.scrollIntoView(from, { y: "center" })] });
}
