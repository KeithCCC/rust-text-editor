import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { EditorSelection, EditorState, StateField, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, WidgetType } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, isolateHistory } from "@codemirror/commands";
import { prepareTableEditing, revealTableSelection, tableEditingExtension } from "../editor/tableEditingExtension";
import { tableInput, tableRuntime } from "../editor/tableEditingState";
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
  preparePendingEdits: () => Promise<boolean>;
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
  language?: "ja" | "en";
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
  { value, mode, themeMode, placeholder, readOnly = false, language = "en", onChange, onFormattingContextChange },
  ref,
) {
  const viewRef = useRef<EditorView | null>(null);
  const effectiveTheme = getEffectiveTheme(themeMode);
  const contextCallback = useRef(onFormattingContextChange);
  contextCallback.current = onFormattingContextChange;
  const tables = useMemo(() => tableEditingExtension({ language, onContextChange: () => {
    const view = viewRef.current;
    if (!view) return;
    contextCallback.current(tableRuntime(view).formattingContext() ?? detectFormattingContext(view.state.doc.toString(), view.state.selection.main));
  } }), [language]);
  const extensions = useMemo<Extension[]>(
    () => [
      history(),
      markdown({ base: markdownLanguage }),
      tables,
      json(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      editorEditableExtension(readOnly),
      EditorState.readOnly.of(readOnly),
      mode === "live" ? livePreviewExtension() : sourceHeadingExtension(),
    ],
    [mode, readOnly, tables],
  );

  useImperativeHandle(ref, () => ({
    preparePendingEdits() {
      return viewRef.current ? prepareTableEditing(viewRef.current) : Promise.resolve(true);
    },
    focus() {
      viewRef.current?.focus();
    },
    selectRange(start: number, end: number) {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const documentLength = view.state.doc.length;
      const clampPosition = (position: number) => (
        Number.isNaN(position)
          ? 0
          : Math.min(documentLength, Math.max(0, Math.trunc(position)))
      );
      const clampedStart = clampPosition(start);
      const clampedEnd = clampPosition(end);
      const from = Math.min(clampedStart, clampedEnd);
      const to = Math.max(clampedStart, clampedEnd);
      revealTableSelection(view, from, to);
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

      if (view.state.readOnly) return;
      if (tableRuntime(view).active) { tableRuntime(view).wrap(before, after, placeholder); return; }
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
      if (!view || view.state.readOnly) return;
      if (tableRuntime(view).active) return tableRuntime(view).format(command, placeholders);
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
      if (view.state.sliceDoc(change.from, change.to) === change.insert) {
        view.focus();
        return change;
      }
      view.dispatch({
        changes: { from: change.from, to: change.to, insert: change.insert },
        selection: EditorSelection.single(change.from + change.selectionStart, change.from + change.selectionEnd),
        annotations: [isolateHistory.of("full"), ...(command.kind === "table" ? [tableInput.of(true)] : [])],
      });
      if (command.kind === "table") {
        const entry = tableRuntime(view).getEntries().find(table => table.from >= change.from && table.to <= change.from + change.insert.length);
        if (entry) { tableRuntime(view).focus({ tableId: entry.id, row: 0, column: 0 }); return change; }
      }
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
            onFormattingContextChange(tableRuntime(update.view).formattingContext() ?? detectFormattingContext(
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
