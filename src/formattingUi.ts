import type { AppLanguage } from "./appLanguage";
import { DEFAULT_FORMATTING_PLACEHOLDERS, type FormattingPlaceholders } from "./markdownFormatting";

type FormattingActionUi = {
  label: string;
  tooltip: string;
  short: string;
};

export type FormattingUi = {
  toolbarLabel: string;
  groups: { text: string; block: string; insert: string };
  actions: Record<string, FormattingActionUi>;
  placeholders: FormattingPlaceholders;
  feedback: Record<"codeBlockInserted" | "tableInserted" | "mermaidInserted" | "multilineInlineCode", string>;
};

const ENGLISH_UI: FormattingUi = {
  toolbarLabel: "Markdown formatting",
  groups: { text: "Text", block: "Block", insert: "Insert" },
  actions: {
    heading: { label: "Heading", tooltip: "Choose a heading level for the current line", short: "H" },
    heading1: { label: "Heading 1", tooltip: "Format the current line as heading level 1", short: "H1" },
    heading2: { label: "Heading 2", tooltip: "Format the current line as heading level 2", short: "H2" },
    heading3: { label: "Heading 3", tooltip: "Format the current line as heading level 3", short: "H3" },
    heading4: { label: "Heading 4", tooltip: "Format the current line as heading level 4", short: "H4" },
    heading5: { label: "Heading 5", tooltip: "Format the current line as heading level 5", short: "H5" },
    heading6: { label: "Heading 6", tooltip: "Format the current line as heading level 6", short: "H6" },
    bold: { label: "Bold", tooltip: "Make the selected text bold", short: "B" },
    italic: { label: "Italic", tooltip: "Make the selected text italic", short: "I" },
    strikethrough: { label: "Strikethrough", tooltip: "Show the selected text with a line through it", short: "S" },
    link: { label: "Link", tooltip: "Add a link to the selected text", short: "Link" },
    inlineCode: { label: "Inline code", tooltip: "Show a short code fragment within a sentence", short: "`code`" },
    quote: { label: "Quote", tooltip: "Format the selected lines as a quotation", short: "❯" },
    list: { label: "List", tooltip: "Choose a list style for the selected lines", short: "List" },
    bulletList: { label: "Bullet list", tooltip: "Format the selected lines as a bulleted list", short: "• List" },
    numberedList: { label: "Numbered list", tooltip: "Format the selected lines as a numbered list", short: "1. List" },
    taskList: { label: "Task list", tooltip: "Format the selected lines as a checklist", short: "☐" },
    codeBlock: { label: "Code Block", tooltip: "Choose a language and insert a standalone code block", short: "Code" },
    codePlain: { label: "Plain text", tooltip: "Insert a code block without syntax highlighting", short: "Text" },
    codeMarkdown: { label: "Markdown", tooltip: "Insert a Markdown code block", short: "MD" },
    codeJavaScript: { label: "JavaScript", tooltip: "Insert a JavaScript code block", short: "JS" },
    codeTypeScript: { label: "TypeScript", tooltip: "Insert a TypeScript code block", short: "TS" },
    codeJson: { label: "JSON", tooltip: "Insert a JSON code block", short: "JSON" },
    codeRust: { label: "Rust", tooltip: "Insert a Rust code block", short: "Rust" },
    codeBash: { label: "Bash", tooltip: "Insert a Bash code block", short: "Bash" },
    codePowerShell: { label: "PowerShell", tooltip: "Insert a PowerShell code block", short: "PS" },
    table: { label: "Table", tooltip: "Insert a table that is rendered as rows and columns in Preview", short: "Table" },
    mermaid: { label: "Mermaid diagram", tooltip: "Insert a Mermaid diagram that is rendered in Preview", short: "Mermaid" },
    more: { label: "More", tooltip: "Show additional formatting actions", short: "More" },
  },
  placeholders: DEFAULT_FORMATTING_PLACEHOLDERS,
  feedback: {
    codeBlockInserted: "Code block inserted. Select a language, then edit the selected code placeholder.",
    tableInserted: "Table inserted. Edit the first column heading.",
    mermaidInserted: "Mermaid diagram inserted. Edit the flowchart source, then use Split to check the result.",
    multilineInlineCode: "Inline code cannot span multiple lines. Use Code Block instead.",
  },
};

const JAPANESE_UI: FormattingUi = {
  toolbarLabel: "Markdown 書式設定",
  groups: { text: "文字", block: "ブロック", insert: "挿入" },
  actions: {
    heading: { label: "見出し", tooltip: "現在の行に設定する見出しレベルを選びます", short: "見出し" },
    heading1: { label: "見出し 1", tooltip: "現在の行をレベル 1 の見出しにします", short: "H1" },
    heading2: { label: "見出し 2", tooltip: "現在の行をレベル 2 の見出しにします", short: "H2" },
    heading3: { label: "見出し 3", tooltip: "現在の行をレベル 3 の見出しにします", short: "H3" },
    heading4: { label: "見出し 4", tooltip: "現在の行をレベル 4 の見出しにします", short: "H4" },
    heading5: { label: "見出し 5", tooltip: "現在の行をレベル 5 の見出しにします", short: "H5" },
    heading6: { label: "見出し 6", tooltip: "現在の行をレベル 6 の見出しにします", short: "H6" },
    bold: { label: "太字", tooltip: "選択した文字を太字にします", short: "太字" },
    italic: { label: "斜体", tooltip: "選択した文字を斜体にします", short: "斜体" },
    strikethrough: { label: "取り消し線", tooltip: "選択した文字に取り消し線を付けます", short: "取消" },
    link: { label: "リンク", tooltip: "選択した文字にリンクを設定します", short: "リンク" },
    inlineCode: { label: "文中コード", tooltip: "選択した短いコードを文中コードとして表示します", short: "`コード`" },
    quote: { label: "引用", tooltip: "選択した行を引用として表示します", short: "引用" },
    list: { label: "リスト", tooltip: "選択した行に設定するリスト形式を選びます", short: "リスト" },
    bulletList: { label: "箇条書き", tooltip: "選択した行を箇条書きにします", short: "・リスト" },
    numberedList: { label: "番号付きリスト", tooltip: "選択した行を番号付きリストにします", short: "1. リスト" },
    taskList: { label: "チェックリスト", tooltip: "選択した行をチェックリストにします", short: "☐" },
    codeBlock: { label: "コードブロック", tooltip: "言語を選んで独立したコードブロックを挿入します", short: "コード" },
    codePlain: { label: "プレーンテキスト", tooltip: "色分けなしのコードブロックを挿入します", short: "テキスト" },
    codeMarkdown: { label: "Markdown", tooltip: "Markdown のコードブロックを挿入します", short: "MD" },
    codeJavaScript: { label: "JavaScript", tooltip: "JavaScript のコードブロックを挿入します", short: "JS" },
    codeTypeScript: { label: "TypeScript", tooltip: "TypeScript のコードブロックを挿入します", short: "TS" },
    codeJson: { label: "JSON", tooltip: "JSON のコードブロックを挿入します", short: "JSON" },
    codeRust: { label: "Rust", tooltip: "Rust のコードブロックを挿入します", short: "Rust" },
    codeBash: { label: "Bash", tooltip: "Bash のコードブロックを挿入します", short: "Bash" },
    codePowerShell: { label: "PowerShell", tooltip: "PowerShell のコードブロックを挿入します", short: "PS" },
    table: { label: "表", tooltip: "表を挿入します。プレビューでは表の行と列として表示されます", short: "表" },
    mermaid: { label: "図（Mermaid）", tooltip: "Mermaid の図を挿入し、プレビューで描画します", short: "図" },
    more: { label: "その他", tooltip: "その他の書式設定を表示します", short: "その他" },
  },
  placeholders: {
    editor: "ここに Markdown を入力してください。",
    bold: "太字",
    italic: "斜体",
    strikethrough: "取り消し線",
    link: "リンク",
    inlineCode: "コード",
    heading: "見出し",
    listItem: "リスト項目",
    task: "タスク",
    quote: "引用",
    codeBlock: "コード",
    table: { column1: "列 1", column2: "列 2", value1: "値 1", value2: "値 2" },
    mermaid: "flowchart TD\n    A[開始] --> B[終了]",
  },
  feedback: {
    codeBlockInserted: "コードブロックを挿入しました。言語を選び、選択中のコード部分を編集してください。",
    tableInserted: "表を挿入しました。最初の列見出しを編集してください。",
    mermaidInserted: "Mermaid の図を挿入しました。フローチャートの定義を編集し、分割表示で結果を確認してください。",
    multilineInlineCode: "文中コードは複数行にできません。コードブロックを使用してください。",
  },
};

export function getFormattingUi(language: AppLanguage): FormattingUi {
  return language === "ja" ? JAPANESE_UI : ENGLISH_UI;
}
