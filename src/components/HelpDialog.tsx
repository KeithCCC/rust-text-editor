import { useEffect, useRef } from "react";

export type HelpLanguage = "en" | "ja";

type HelpDialogProps = {
  language: HelpLanguage;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
};

type HelpSection = {
  title: string;
  paragraphs: string[];
  examples?: Array<{ source: string; meaning: string }>;
  codeExample?: string;
};

type HelpContent = {
  title: string;
  introduction: string;
  identityAlt: string;
  close: string;
  closeLabel: string;
  shortcutsTitle: string;
  actionHeading: string;
  shortcutHeading: string;
  sections: HelpSection[];
  shortcuts: Array<{ action: string; keys: string }>;
};

const HELP_CONTENT: Record<HelpLanguage, HelpContent> = {
  en: {
    title: "How to use Koharu",
    introduction: "The essentials for writing and saving a Markdown document.",
    identityAlt: "Koharu flower icon",
    close: "Close",
    closeLabel: "Close How to use Koharu",
    shortcutsTitle: "Keyboard shortcuts",
    actionHeading: "Action",
    shortcutHeading: "Shortcut",
    sections: [
      {
        title: "Create, open, and save files",
        paragraphs: [
          "Choose File > New to start a blank document, or File > Open to edit an existing text or Markdown file.",
          "Choose File > Save regularly. Use Save As when you want to choose a new file name or location.",
        ],
      },
      {
        title: "Choose a view",
        paragraphs: [
          "Use Edit when you only need the editor, Split to see the editor and rendered result together, and Preview when you only need the rendered result. Choose between Edit, Split, and Preview with the controls at the top of the window.",
        ],
      },
      {
        title: "Toolbar, file path, and Find",
        paragraphs: [
          "Use the control in the editor header to show or hide the formatting toolbar. Your choice is remembered the next time you open Koharu.",
          "The current file path appears in the bottom status bar. If it is truncated, hover it to see the full path.",
          "Click Search in the menu bar or press Ctrl+F. Click Search again or press Escape to close it. If you start from Preview, Koharu automatically switches to Split and focuses the visible search field.",
        ],
      },
      {
        title: "Markdown basics",
        paragraphs: ["The toolbar inserts literal Markdown marks. You can select and copy every source example below."],
        examples: [
          { source: "# Heading", meaning: "Heading" },
          { source: "**Bold**", meaning: "Bold" },
          { source: "*Italic*", meaning: "Italic" },
          { source: "- List item", meaning: "Bulleted list" },
          { source: "[Link](https://example.com)", meaning: "Link" },
        ],
      },
      {
        title: "Text",
        paragraphs: [
          "Use Heading for document structure; Bold, Italic, and Strikethrough for emphasis; Link for a destination; and Inline code for a short fragment within a sentence.",
        ],
        examples: [
          { source: "# Heading", meaning: "Heading — a section title" },
          { source: "**Bold**", meaning: "Bold — strong emphasis" },
          { source: "_Italic_", meaning: "Italic — light emphasis" },
          { source: "~~Removed~~", meaning: "Strikethrough — text that no longer applies" },
          { source: "[Koharu](https://example.com)", meaning: "Link — clickable linked text" },
          { source: "`code`", meaning: "Inline code — a short code fragment inside a sentence" },
        ],
      },
      {
        title: "Block",
        paragraphs: [
          "Block actions format complete lines. Use Code block for multi-line code; unlike Inline code, it stands on its own and can specify a language.",
          "A Task list adds checkboxes, while Bullet and Numbered lists organize ordinary list items.",
        ],
        examples: [
          { source: "> Quoted text", meaning: "Quote — a quotation on its own line" },
          { source: "- List item", meaning: "Bullet list — unordered items" },
          { source: "1. First item", meaning: "Numbered list — ordered steps" },
          { source: "- [ ] Task", meaning: "Task list — an unchecked task" },
          { source: "```javascript\nconsole.log(\"Hello\");\n```", meaning: "Code block — multi-line JavaScript code" },
        ],
      },
      {
        title: "Insert",
        paragraphs: [
          "Table inserts rows and columns. Mermaid diagram inserts a flowchart definition that becomes a diagram in Split or Preview.",
        ],
        examples: [
          { source: "| Heading 1 | Heading 2 |\n| --- | --- |\n| Value 1 | Value 2 |", meaning: "Table — rendered rows and columns" },
        ],
        codeExample: "```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```",
      },
    ],
    shortcuts: [
      { action: "New document", keys: "Ctrl+N" },
      { action: "Open file", keys: "Ctrl+O" },
      { action: "Save", keys: "Ctrl+S" },
      { action: "Save As", keys: "Ctrl+Shift+S" },
      { action: "Find", keys: "Ctrl+F" },
      { action: "Bold", keys: "Ctrl+B" },
      { action: "Italic", keys: "Ctrl+I" },
      { action: "Cycle Edit, Split, and Preview", keys: "Ctrl/Cmd+Alt+M" },
    ],
  },
  ja: {
    title: "Koharuの使い方",
    introduction: "Markdown文書を書いて保存するための、基本的な使い方です。",
    identityAlt: "Koharuの花のアイコン",
    close: "閉じる",
    closeLabel: "Koharuの使い方を閉じる",
    shortcutsTitle: "キーボードショートカット",
    actionHeading: "操作",
    shortcutHeading: "ショートカット",
    sections: [
      {
        title: "ファイルを作る・開く・保存する",
        paragraphs: [
          "「ファイル」→「新規」で空の文書を作れます。「開く」では、既存のテキストファイルやMarkdownファイルを編集できます。",
          "編集中はこまめに「保存」を選びます。別の名前や場所へ保存するときは「名前を付けて保存」を使います。",
        ],
      },
      {
        title: "表示を選ぶ",
        paragraphs: [
          "編集だけを行うときは「編集」、編集画面と仕上がりを並べるときは「分割」、仕上がりだけを見るときは「プレビュー」を使います。画面上部の「編集・分割・プレビュー」で切り替えられます。",
        ],
      },
      {
        title: "ツールバー・ファイルパス・検索",
        paragraphs: [
          "エディターヘッダーのボタンで、書式ツールバーの表示・非表示を切り替えられます。選択は保存され、次回も引き継がれます。",
          "現在のファイルパスは画面下部のステータスバーに表示されます。省略されている場合は、マウスを重ねると完全なパスを確認できます。",
          "メニューバーの「検索」をクリックするかCtrl+Fを押します。もう一度「検索」をクリックするかEscapeを押すと閉じます。プレビューから検索すると、自動的に分割表示へ切り替わり、見える検索欄にフォーカスします。",
        ],
      },
      {
        title: "Markdownの書き方",
        paragraphs: ["ツールバーはMarkdownの記号をそのまま挿入します。以下のソース例は選択してコピーできます。"],
        examples: [
          { source: "# 見出し", meaning: "見出し" },
          { source: "**太字**", meaning: "太字" },
          { source: "*斜体*", meaning: "斜体" },
          { source: "- 箇条書き", meaning: "箇条書き" },
          { source: "[リンク](https://example.com)", meaning: "リンク" },
        ],
      },
      {
        title: "文字",
        paragraphs: [
          "見出しは文書の構成に、太字・斜体・取り消し線は強調に、リンクは移動先の設定に使います。文中コードは文章内の短いコードに使います。",
        ],
        examples: [
          { source: "# 見出し", meaning: "見出し — 節のタイトル" },
          { source: "**太字**", meaning: "太字 — 強い強調" },
          { source: "_斜体_", meaning: "斜体 — 軽い強調" },
          { source: "~~削除済み~~", meaning: "取り消し線 — 現在は無効な内容" },
          { source: "[Koharu](https://example.com)", meaning: "リンク — クリックできる文字" },
          { source: "`コード`", meaning: "文中コード — 文章内の短いコード" },
        ],
      },
      {
        title: "ブロック",
        paragraphs: [
          "ブロックの操作は行全体を書式設定します。複数行のコードには、文章内で使う文中コードではなくコードブロックを使い、必要に応じて言語を選びます。",
          "チェックリストにはチェック欄が付き、箇条書きと番号付きリストは通常の項目整理に使います。",
        ],
        examples: [
          { source: "> 引用文", meaning: "引用 — 独立した行の引用" },
          { source: "- 項目", meaning: "箇条書き — 順序のない項目" },
          { source: "1. 最初の項目", meaning: "番号付きリスト — 順序のある手順" },
          { source: "- [ ] タスク", meaning: "チェックリスト — 未完了のタスク" },
          { source: "```javascript\nconsole.log(\"こんにちは\");\n```", meaning: "コードブロック — 複数行のJavaScriptコード" },
        ],
      },
      {
        title: "挿入",
        paragraphs: [
          "表は行と列を挿入します。図（Mermaid）はフローチャートの定義を挿入し、分割表示またはプレビューで図として表示します。",
        ],
        examples: [
          { source: "| 見出し 1 | 見出し 2 |\n| --- | --- |\n| 値 1 | 値 2 |", meaning: "表 — 行と列として表示" },
        ],
        codeExample: "```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```",
      },
    ],
    shortcuts: [
      { action: "新規文書", keys: "Ctrl+N" },
      { action: "ファイルを開く", keys: "Ctrl+O" },
      { action: "保存", keys: "Ctrl+S" },
      { action: "名前を付けて保存", keys: "Ctrl+Shift+S" },
      { action: "検索", keys: "Ctrl+F" },
      { action: "太字", keys: "Ctrl+B" },
      { action: "斜体", keys: "Ctrl+I" },
      { action: "編集・分割・プレビューを切り替える", keys: "Ctrl/Cmd+Alt+M" },
    ],
  },
};

export function handleHelpDialogKeyDown(
  event: Pick<KeyboardEvent, "key">,
  onClose: () => void,
) {
  if (event.key === "Escape") {
    onClose();
  }
}

export function HelpDialog({ language, onClose, returnFocusTo }: HelpDialogProps) {
  const content = HELP_CONTENT[language];
  const backdropRef = useRef<HTMLElement | null>(null);
  const initialFocusRef = useRef<HTMLElement | null>(
    returnFocusTo ?? (typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null),
  );
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const backdrop = backdropRef.current;
    const dialog = backdrop?.querySelector<HTMLElement>('[role="dialog"]');
    if (!backdrop || !dialog) return;
    const backgroundElements = Array.from(backdrop.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop);
    const previousInert = backgroundElements.map((element) => element.hasAttribute("inert"));
    for (const element of backgroundElements) element.setAttribute("inert", "");

    const focusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    const focusFirst = () => (closeButtonRef.current ?? focusableElements()[0])?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Node) || dialog.contains(event.target)) return;
      focusFirst();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", containFocus, true);
    focusFirst();
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", containFocus, true);
      backgroundElements.forEach((element, index) => {
        if (!previousInert[index]) element.removeAttribute("inert");
      });
      initialFocusRef.current?.focus();
    };
  }, []);

  return (
    <section ref={backdropRef} className="modal-backdrop help-dialog-backdrop">
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
      >
        <header className="modal-toolbar">
          <div>
            <strong id="help-dialog-title">{content.title}</strong>
          </div>
          <button ref={closeButtonRef} type="button" aria-label={content.closeLabel} onClick={onClose}>×</button>
        </header>

        <div className="help-dialog-body">
          <div className="help-identity">
            <img
              className="help-identity-icon"
              src="/koharu-release-icon.png"
              alt={content.identityAlt}
            />
            <strong className="help-identity-name">Koharu</strong>
            <p className="help-identity-introduction">{content.introduction}</p>
          </div>
          <div className="help-sections">
            {content.sections.map((section) => (
              <section
                className={`help-section${section.examples || section.codeExample ? " help-section-wide" : ""}`}
                key={section.title}
              >
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.examples && (
                  <dl className="help-markdown-examples">
                    {section.examples.map((example) => (
                      <div key={example.source}>
                        <dt><code>{example.source}</code></dt>
                        <dd>{example.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {section.codeExample && (
                  <pre className="help-code-example"><code>{section.codeExample}</code></pre>
                )}
              </section>
            ))}
          </div>

          <section className="help-shortcuts-section">
            <h2>{content.shortcutsTitle}</h2>
            <table className="help-shortcuts">
              <thead>
                <tr><th>{content.actionHeading}</th><th>{content.shortcutHeading}</th></tr>
              </thead>
              <tbody>
                {content.shortcuts.map((shortcut) => (
                  <tr key={shortcut.keys}>
                    <td>{shortcut.action}</td>
                    <td><kbd>{shortcut.keys}</kbd></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <footer className="help-dialog-footer">
          <button type="button" onClick={onClose}>{content.close}</button>
        </footer>
      </div>
    </section>
  );
}
