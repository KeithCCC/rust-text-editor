import type { MarkdownFormat } from "../markdownFormatting";

type MarkdownToolbarProps = {
  onFormat: (format: MarkdownFormat) => void;
};

const ACTIONS: { format: MarkdownFormat; label: string; short: string }[] = [
  { format: "heading", label: "Heading", short: "H" },
  { format: "bold", label: "Bold", short: "B" },
  { format: "italic", label: "Italic", short: "I" },
  { format: "strikethrough", label: "Strikethrough", short: "S" },
  { format: "link", label: "Link", short: "Link" },
  { format: "bulletList", label: "Bullet List", short: "• List" },
  { format: "numberedList", label: "Numbered List", short: "1. List" },
  { format: "taskList", label: "Task List", short: "☐" },
  { format: "quote", label: "Quote", short: "❯" },
  { format: "inlineCode", label: "Inline Code", short: "`code`" },
  { format: "codeBlock", label: "Code Block", short: "Code" },
  { format: "table", label: "Table", short: "Table" },
  { format: "mermaid", label: "Mermaid", short: "Mermaid" },
];

export function MarkdownToolbar({ onFormat }: MarkdownToolbarProps) {
  return (
    <div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting">
      {ACTIONS.map((action) => (
        <button key={action.format} type="button" title={action.label} aria-label={action.label} onClick={() => onFormat(action.format)}>
          {action.short}
        </button>
      ))}
    </div>
  );
}
