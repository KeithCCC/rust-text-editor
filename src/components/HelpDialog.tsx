import { useEffect } from "react";

export type HelpLanguage = "en" | "ja";

type HelpDialogProps = {
  language: HelpLanguage;
  onClose: () => void;
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
        title: "Write and preview",
        paragraphs: [
          "Write in the editor. Use the Preview button at the far right of the menu bar to show or hide the rendered result.",
          "Choose Search > Find to find text in the current document.",
        ],
      },
      {
        title: "Markdown basics",
        paragraphs: ["Type these simple marks to format your document."],
        examples: [
          { source: "# Heading", meaning: "Heading" },
          { source: "**Bold**", meaning: "Bold" },
          { source: "*Italic*", meaning: "Italic" },
          { source: "- List item", meaning: "Bulleted list" },
          { source: "[Link](https://example.com)", meaning: "Link" },
        ],
      },
      {
        title: "Mermaid diagrams",
        paragraphs: [
          "Write a fenced code block labeled mermaid to render a diagram in Preview.",
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
      { action: "Toggle preview", keys: "Ctrl+Shift+V" },
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
        title: "文章を書く・プレビューする",
        paragraphs: [
          "エディターに文章を入力します。メニューバー右端のPreviewボタンで、仕上がり表示を出したり隠したりできます。",
          "文書内の文字を探すときは「検索」→「検索」を選びます。",
        ],
      },
      {
        title: "Markdownの書き方",
        paragraphs: ["次のような簡単な記号を入力すると、文章に書式を付けられます。"],
        examples: [
          { source: "# 見出し", meaning: "見出し" },
          { source: "**太字**", meaning: "太字" },
          { source: "*斜体*", meaning: "斜体" },
          { source: "- 箇条書き", meaning: "箇条書き" },
          { source: "[リンク](https://example.com)", meaning: "リンク" },
        ],
      },
      {
        title: "Mermaid図",
        paragraphs: [
          "mermaidと指定したコードブロックを書くと、プレビューに図として表示されます。",
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
      { action: "プレビューを切り替える", keys: "Ctrl+Shift+V" },
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

export function HelpDialog({ language, onClose }: HelpDialogProps) {
  const content = HELP_CONTENT[language];

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleHelpDialogKeyDown(event, onClose);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  return (
    <section className="modal-backdrop help-dialog-backdrop">
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
          <button type="button" aria-label={content.closeLabel} onClick={onClose}>×</button>
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
