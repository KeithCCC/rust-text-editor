import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { EditorSelection, EditorState, StateField, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, WidgetType } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, isolateHistory } from "@codemirror/commands";
import {
  deleteTableColumn,
  deleteTableRow,
  insertTableColumnAfter,
  insertTableRowAfter,
  isMarkdownTableDivider,
  isMarkdownTableRow,
  parseMarkdownTable,
  serializeMarkdownTable,
  updateTableCell,
  type MarkdownTable,
} from "../tableMarkdown";
import {
  detectFormattingContext,
  formatMarkdownSelection,
  type FormatResult,
  type FormattingPlaceholders,
  type FormattingContext,
  type MarkdownCommand,
} from "../markdownFormatting";

export type EditorMode = "live" | "source" | "split";

export type MarkdownEditorHandle = {
  focus: () => void;
  selectRange: (start: number, end: number) => void;
  getScrollElement: () => HTMLElement | null;
  wrapSelection: (before: string, after: string, placeholder: string) => void;
  applyFormat: (command: MarkdownCommand, placeholders: FormattingPlaceholders) => FormatResult | undefined;
};

type MarkdownEditorProps = {
  value: string;
  mode: EditorMode;
  themeMode: "system" | "light" | "dark";
  placeholder: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onFormattingContextChange: (context: FormattingContext) => void;
};

export function editorEditableExtension(readOnly: boolean) {
  return EditorView.editable.of(!readOnly);
}

type LivePreviewContext = {
  state: EditorState;
  visibleRanges: readonly { from: number; to: number }[];
};

function getEffectiveTheme(themeMode: MarkdownEditorProps["themeMode"]) {
  if (themeMode !== "system") {
    return themeMode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

class TaskCheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  toDOM() {
    const checkbox = document.createElement("span");
    checkbox.className = `hotaru-live-taskbox${this.checked ? " checked" : ""}`;
    checkbox.setAttribute("aria-hidden", "true");
    return checkbox;
  }

  ignoreEvent() {
    return true;
  }
}

class ListBulletWidget extends WidgetType {
  toDOM() {
    const bullet = document.createElement("span");
    bullet.className = "hotaru-live-bullet";
    bullet.setAttribute("aria-hidden", "true");
    return bullet;
  }

  ignoreEvent() {
    return true;
  }
}

class HtmlBreakWidget extends WidgetType {
  toDOM() {
    const lineBreak = document.createElement("span");
    lineBreak.className = "hotaru-live-break";
    lineBreak.append(document.createElement("br"));
    return lineBreak;
  }

  ignoreEvent() {
    return true;
  }
}

class TableWidget extends WidgetType {
  constructor(private readonly table: MarkdownTable) {
    super();
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement("div");
    wrapper.className = "hotaru-live-table-wrap";

    const toolbar = document.createElement("div");
    toolbar.className = "hotaru-live-table-toolbar";
    toolbar.append(
      this.createButton("Add row", () => this.replaceTable(view, insertTableRowAfter(this.table, this.table.rows.length - 1))),
      this.createButton("Add column", () => this.replaceTable(view, insertTableColumnAfter(this.table, this.table.headers.length - 1, "New column"))),
    );
    wrapper.append(toolbar);

    const table = document.createElement("table");
    table.className = "hotaru-live-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const [index, header] of this.table.headers.entries()) {
      const th = document.createElement("th");
      th.append(this.createCellEditor(view, 0, index, header.text, true));
      th.append(this.createColumnControls(view, index));
      headerRow.append(th);
    }
    thead.append(headerRow);
    table.append(thead);

    const tbody = document.createElement("tbody");
    for (const [rowIndex, row] of this.table.rows.entries()) {
      const tr = document.createElement("tr");
      for (let index = 0; index < this.table.headers.length; index += 1) {
        const td = document.createElement("td");
        td.append(this.createCellEditor(view, rowIndex + 1, index, row.cells[index]?.text ?? ""));
        tr.append(td);
      }
      const controls = document.createElement("td");
      controls.className = "hotaru-live-table-row-controls";
      controls.append(
        this.createButton("+", () => this.replaceTable(view, insertTableRowAfter(this.table, rowIndex)), "Add row below"),
        this.createButton("Delete", () => this.replaceTable(view, deleteTableRow(this.table, rowIndex)), "Delete row"),
      );
      tr.append(controls);
      tbody.append(tr);
    }
    table.append(tbody);
    wrapper.append(table);

    return wrapper;
  }

  ignoreEvent() {
    return true;
  }

  private replaceTable(view: EditorView, table: MarkdownTable, focusCell?: { row: number; column: number }) {
    view.dispatch({
      changes: { from: this.table.from, to: this.table.to, insert: serializeMarkdownTable(table) },
      selection: EditorSelection.single(this.table.from),
    });

    if (focusCell) {
      this.focusCell(view, focusCell);
    }
  }

  private focusCell(view: EditorView, focusCell: { row: number; column: number }) {
    window.requestAnimationFrame(() => {
      const selector = `[data-hotaru-table-cell="${focusCell.row}:${focusCell.column}"]`;
      const input = view.dom.querySelector<HTMLTextAreaElement>(selector);
      input?.focus();
      input?.select();
    });
  }

  private createButton(label: string, onClick: () => void, title = label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.className = "hotaru-live-table-button";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private createColumnControls(view: EditorView, columnIndex: number) {
    const controls = document.createElement("span");
    controls.className = "hotaru-live-table-column-controls";
    controls.append(
      this.createButton("+", () => this.replaceTable(view, insertTableColumnAfter(this.table, columnIndex, "New column")), "Add column after"),
      this.createButton("Delete", () => this.replaceTable(view, deleteTableColumn(this.table, columnIndex)), "Delete column"),
    );
    return controls;
  }

  private createCellEditor(view: EditorView, rowIndex: number, columnIndex: number, value: string, isHeader = false) {
    const textarea = document.createElement("textarea");
    textarea.className = `hotaru-live-table-cell-editor${isHeader ? " is-header" : ""}`;
    textarea.value = value;
    textarea.rows = Math.max(1, value.split(/\r?\n/).length);
    textarea.dataset.hotaruTableCell = `${rowIndex}:${columnIndex}`;
    textarea.setAttribute("aria-label", `Table ${isHeader ? "header" : "cell"} ${rowIndex + 1}, ${columnIndex + 1}`);

    const commit = (focusCell?: { row: number; column: number }) => {
      if (textarea.value === value) {
        if (focusCell) {
          this.focusCell(view, focusCell);
        }
        return;
      }
      this.replaceTable(view, updateTableCell(this.table, rowIndex, columnIndex, textarea.value), focusCell);
    };

    textarea.addEventListener("input", () => {
      textarea.rows = Math.max(1, textarea.value.split(/\r?\n/).length);
    });
    textarea.addEventListener("blur", () => commit());
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        const next = this.nextCell(rowIndex, columnIndex, event.shiftKey ? -1 : 1);
        commit(next);
      }
      if (event.key === "Escape") {
        textarea.value = value;
        textarea.blur();
        view.focus();
      }
    });

    return textarea;
  }

  private nextCell(rowIndex: number, columnIndex: number, direction: 1 | -1) {
    const columnCount = this.table.headers.length;
    const rowCount = this.table.rows.length + 1;
    const flatIndex = rowIndex * columnCount + columnIndex + direction;
    const clamped = Math.max(0, Math.min(flatIndex, rowCount * columnCount - 1));
    return { row: Math.floor(clamped / columnCount), column: clamped % columnCount };
  }
}

function findActiveBlock(context: LivePreviewContext) {
  const cursor = context.state.selection.main.head;
  let startLine = context.state.doc.lineAt(cursor);
  let endLine = startLine;

  while (startLine.number > 1) {
    const previous = context.state.doc.line(startLine.number - 1);
    if (previous.text.trim() === "") {
      break;
    }
    startLine = previous;
  }

  while (endLine.number < context.state.doc.lines) {
    const next = context.state.doc.line(endLine.number + 1);
    if (next.text.trim() === "") {
      break;
    }
    endLine = next;
  }

  return { from: startLine.from, to: endLine.to };
}

function appendText(parent: HTMLElement, text: string) {
  if (text) {
    parent.append(document.createTextNode(text));
  }
}

function appendInlinePreview(parent: HTMLElement, source: string) {
  const tokenPattern = /(<br\s*\/?>|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/gi;
  let lastIndex = 0;

  for (const match of source.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    appendText(parent, source.slice(lastIndex, index));

    if (match[1].toLowerCase().startsWith("<br")) {
      parent.append(document.createElement("br"));
    } else if (match[2] || match[3]) {
      const strong = document.createElement("strong");
      strong.textContent = match[2] ?? match[3];
      parent.append(strong);
    } else if (match[4]) {
      const code = document.createElement("code");
      code.textContent = match[4];
      parent.append(code);
    } else if (match[5]) {
      const span = document.createElement("span");
      span.className = "hotaru-live-link";
      span.textContent = match[5];
      parent.append(span);
    }

    lastIndex = index + match[0].length;
  }

  appendText(parent, source.slice(lastIndex));
}

function findTableHeaderLine(context: LivePreviewContext, lineNumber: number) {
  if (lineNumber >= context.state.doc.lines) {
    return null;
  }

  const current = context.state.doc.line(lineNumber);
  if (!isMarkdownTableRow(current.text)) {
    return null;
  }

  let firstTableLineNumber = lineNumber;
  while (firstTableLineNumber > 1) {
    const previous = context.state.doc.line(firstTableLineNumber - 1);
    if (!isMarkdownTableRow(previous.text) || previous.text.trim() === "") {
      break;
    }
    firstTableLineNumber -= 1;
  }

  for (let candidate = firstTableLineNumber; candidate <= lineNumber; candidate += 1) {
    if (candidate >= context.state.doc.lines) {
      break;
    }
    const header = context.state.doc.line(candidate);
    const divider = context.state.doc.line(candidate + 1);
    if (isMarkdownTableRow(header.text) && isMarkdownTableDivider(divider.text)) {
      return header;
    }
  }

  return null;
}

function readTableAt(context: LivePreviewContext, lineNumber: number) {
  const header = findTableHeaderLine(context, lineNumber);
  if (!header) {
    return null;
  }

  const divider = context.state.doc.line(header.number + 1);
  if (!isMarkdownTableDivider(divider.text)) {
    return null;
  }

  let endLine = divider;
  let nextLineNumber = header.number + 2;
  while (nextLineNumber <= context.state.doc.lines) {
    const row = context.state.doc.line(nextLineNumber);
    if (!isMarkdownTableRow(row.text) || row.text.trim() === "") {
      break;
    }
    endLine = row;
    nextLineNumber += 1;
  }

  const source = context.state.sliceDoc(header.from, endLine.to);
  const table = parseMarkdownTable(source, header.from, endLine.to);
  if (!table) {
    return null;
  }

  return {
    from: header.from,
    to: endLine.to,
    endLineNumber: endLine.number,
    table,
  };
}

function addHiddenRange(decorations: Range<Decoration>[], from: number, to: number) {
  if (to > from) {
    decorations.push(Decoration.replace({ inclusive: false }).range(from, to));
  }
}

function addInlinePreviewDecorations(decorations: Range<Decoration>[], lineFrom: number, text: string) {
  const markerPatterns = [
    /\*\*([^*\n]+)\*\*/g,
    /__([^_\n]+)__/g,
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    /(?<!_)_([^_\n]+)_(?!_)/g,
    /`([^`\n]+)`/g,
  ];

  for (const pattern of markerPatterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const full = match[0];
      const inner = match[1];
      const prefixLength = full.indexOf(inner);
      addHiddenRange(decorations, lineFrom + index, lineFrom + index + prefixLength);
      addHiddenRange(decorations, lineFrom + index + prefixLength + inner.length, lineFrom + index + full.length);
    }
  }

  for (const match of text.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const index = match.index ?? 0;
    addHiddenRange(decorations, lineFrom + index, lineFrom + index + 2);
    addHiddenRange(decorations, lineFrom + index + match[0].length - 2, lineFrom + index + match[0].length);
  }

  for (const match of text.matchAll(/\[([^\]\n]+)\]\(([^)\n]+)\)/g)) {
    const index = match.index ?? 0;
    const label = match[1];
    addHiddenRange(decorations, lineFrom + index, lineFrom + index + 1);
    addHiddenRange(decorations, lineFrom + index + 1 + label.length, lineFrom + index + match[0].length);
  }
}

function addHtmlBreakDecorations(decorations: Range<Decoration>[], lineFrom: number, text: string) {
  for (const match of text.matchAll(/<br\s*\/?>/gi)) {
    const index = match.index ?? 0;
    decorations.push(
      Decoration.replace({
        widget: new HtmlBreakWidget(),
        inclusive: false,
      }).range(lineFrom + index, lineFrom + index + match[0].length),
    );
  }
}

function buildLivePreviewDecorations(context: LivePreviewContext) {
  const activeBlock = findActiveBlock(context);
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of context.visibleRanges) {
    let position = from;
    while (position <= to) {
      const line = context.state.doc.lineAt(position);
      const text = line.text;
      const isActiveBlock = line.from <= activeBlock.to && line.to >= activeBlock.from;
      addHtmlBreakDecorations(decorations, line.from, text);

      const table = readTableAt(context, line.number);
      if (table && table.from >= from) {
        decorations.push(
          Decoration.widget({
              widget: new TableWidget(table.table),
              block: true,
            }).range(table.from),
        );
        for (let tableLineNumber = line.number; tableLineNumber <= table.endLineNumber; tableLineNumber += 1) {
          decorations.push(
            Decoration.line({ class: "hotaru-live-hidden-table-source" }).range(context.state.doc.line(tableLineNumber).from),
          );
        }
        position = table.to + 1;
        continue;
      }

      if (isActiveBlock) {
      } else {

        const heading = /^(#{1,6})\s+/.exec(text);
        if (heading) {
          const level = Math.min(heading[1].length, 6);
          decorations.push(Decoration.line({ class: `hotaru-live-heading hotaru-live-h${level}` }).range(line.from));
          addHiddenRange(decorations, line.from, line.from + heading[0].length);
        }

        const blockquote = /^(\s*)>\s?/.exec(text);
        if (blockquote) {
          decorations.push(Decoration.line({ class: "hotaru-live-blockquote" }).range(line.from));
          addHiddenRange(decorations, line.from + blockquote[1].length, line.from + blockquote[0].length);
        }

        const task = /^(\s*)[-*+]\s+\[([ xX])\]\s+/.exec(text);
        if (task) {
          const markerStart = line.from + task[1].length;
          decorations.push(Decoration.line({ class: "hotaru-live-task" }).range(line.from));
          decorations.push(
            Decoration.replace({
              widget: new TaskCheckboxWidget(task[2].toLowerCase() === "x"),
              inclusive: false,
            }).range(markerStart, line.from + task[0].length),
          );
        } else {
          const unorderedList = /^(\s*)[-*+]\s+/.exec(text);
          if (unorderedList) {
            const markerStart = line.from + unorderedList[1].length;
            decorations.push(
              Decoration.replace({
                widget: new ListBulletWidget(),
                inclusive: false,
              }).range(markerStart, line.from + unorderedList[0].length),
            );
          }
        }

        const fence = /^(\s*)```(\w+)?/.exec(text);
        if (fence) {
          decorations.push(Decoration.line({ class: "hotaru-live-fence" }).range(line.from));
        }

        addInlinePreviewDecorations(decorations, line.from, text);
      }

      if (line.to >= to || line.number === context.state.doc.lines) {
        break;
      }
      position = line.to + 1;
    }
  }

  return Decoration.set(decorations, true);
}

function livePreviewExtension() {
  const livePreviewDecorations = StateField.define({
    create(state) {
      return buildLivePreviewDecorations({ state, visibleRanges: [{ from: 0, to: state.doc.length }] });
    },
    update(_decorations, transaction) {
      return buildLivePreviewDecorations({
        state: transaction.state,
        visibleRanges: [{ from: 0, to: transaction.state.doc.length }],
      });
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return livePreviewDecorations;
}

function buildSourceHeadingDecorations(state: EditorState) {
  const decorations: Range<Decoration>[] = [];
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const heading = /^(#{1,4})\s+/.exec(line.text);
    if (heading) {
      decorations.push(
        Decoration.line({ class: `hotaru-source-heading hotaru-source-h${heading[1].length}` }).range(line.from),
      );
    }
  }

  return Decoration.set(decorations);
}

function sourceHeadingExtension() {
  const sourceHeadingDecorations = StateField.define({
    create(state) {
      return buildSourceHeadingDecorations(state);
    },
    update(decorations, transaction) {
      return transaction.docChanged ? buildSourceHeadingDecorations(transaction.state) : decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return sourceHeadingDecorations;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  { value, mode, themeMode, placeholder, readOnly = false, onChange, onFormattingContextChange },
  ref,
) {
  const viewRef = useRef<EditorView | null>(null);
  const effectiveTheme = getEffectiveTheme(themeMode);
  const extensions = useMemo<Extension[]>(
    () => [
      history(),
      markdown(),
      json(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      editorEditableExtension(readOnly),
      EditorState.readOnly.of(readOnly),
      mode === "live" ? livePreviewExtension() : sourceHeadingExtension(),
    ],
    [mode, readOnly],
  );

  useImperativeHandle(ref, () => ({
    focus() {
      viewRef.current?.focus();
    },
    selectRange(start: number, end: number) {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      view.dispatch({
        selection: EditorSelection.single(start, end),
        effects: EditorView.scrollIntoView(start, { y: "center" }),
      });
      view.focus();
    },
    getScrollElement() {
      return viewRef.current?.scrollDOM ?? null;
    },
    wrapSelection(before: string, after: string, placeholder: string) {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const selection = view.state.selection.main;
      const selected = view.state.sliceDoc(selection.from, selection.to);
      const insert = `${before}${selected || placeholder}${after}`;
      const cursorFrom = selected ? selection.from : selection.from + before.length;
      const cursorTo = selected ? selection.from + insert.length : cursorFrom + placeholder.length;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert },
        selection: EditorSelection.single(cursorFrom, cursorTo),
      });
      view.focus();
    },
    applyFormat(command: MarkdownCommand, placeholders: FormattingPlaceholders) {
      const view = viewRef.current;
      if (!view) return;
      const selection = view.state.selection.main;
      const change: FormatResult = formatMarkdownSelection(
        view.state.doc.toString(),
        { from: selection.from, to: selection.to },
        command,
        placeholders,
      );
      if (change.warning) {
        view.focus();
        return change;
      }
      view.dispatch({
        changes: { from: change.from, to: change.to, insert: change.insert },
        selection: EditorSelection.single(change.from + change.selectionStart, change.from + change.selectionEnd),
        annotations: isolateHistory.of("full"),
      });
      view.focus();
      return change;
    },
  }), []);

  return (
    <div className="markdown-editor" data-editor-mode={mode}>
      <CodeMirror
        value={value}
        height="100%"
        basicSetup={false}
        theme={effectiveTheme}
        extensions={extensions}
        onChange={onChange}
        onUpdate={(update) => {
          if (update.docChanged || update.selectionSet) {
            const selection = update.state.selection.main;
            onFormattingContextChange(detectFormattingContext(
              update.state.doc.toString(),
              { from: selection.from, to: selection.to },
            ));
          }
        }}
        onCreateEditor={(view) => {
          viewRef.current = view;
          const selection = view.state.selection.main;
          onFormattingContextChange(detectFormattingContext(
            view.state.doc.toString(),
            { from: selection.from, to: selection.to },
          ));
        }}
        placeholder={placeholder}
      />
    </div>
  );
});
