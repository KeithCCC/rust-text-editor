import type { MarkdownCommand } from "../markdownFormatting";

type MarkdownToolbarProps = {
  disabled?: boolean;
  onFormat: (command: MarkdownCommand) => void;
};

const ACTIONS: { command: MarkdownCommand; label: string; short: string }[] = [
  { command: { kind: "heading", level: 1 }, label: "Heading", short: "H" },
  { command: { kind: "bold" }, label: "Bold", short: "B" },
  { command: { kind: "italic" }, label: "Italic", short: "I" },
  { command: { kind: "strikethrough" }, label: "Strikethrough", short: "S" },
  { command: { kind: "link" }, label: "Link", short: "Link" },
  { command: { kind: "bulletList" }, label: "Bullet List", short: "• List" },
  { command: { kind: "numberedList" }, label: "Numbered List", short: "1. List" },
  { command: { kind: "taskList" }, label: "Task List", short: "☐" },
  { command: { kind: "quote" }, label: "Quote", short: "❯" },
  { command: { kind: "inlineCode" }, label: "Inline Code", short: "`code`" },
  { command: { kind: "codeBlock", language: "" }, label: "Code Block", short: "Code" },
  { command: { kind: "table" }, label: "Table", short: "Table" },
  { command: { kind: "mermaid" }, label: "Mermaid", short: "Mermaid" },
];

export function MarkdownToolbar({ disabled = false, onFormat }: MarkdownToolbarProps) {
  return (
    <div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting">
      {ACTIONS.map((action) => (
        <button key={action.label} type="button" title={action.label} aria-label={action.label} disabled={disabled} onClick={() => onFormat(action.command)}>
          {action.short}
        </button>
      ))}
    </div>
  );
}
