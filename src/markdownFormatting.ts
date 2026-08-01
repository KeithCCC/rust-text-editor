export type MarkdownFormat =
  | "heading" | "bold" | "italic" | "strikethrough" | "link"
  | "bulletList" | "numberedList" | "taskList" | "quote"
  | "inlineCode" | "codeBlock" | "table" | "mermaid";

export type MarkdownChange = {
  from: number;
  to: number;
  insert: string;
  selectionStart: number;
  selectionEnd: number;
};

export function formatMarkdownSelection(document: string, from: number, to: number, format: MarkdownFormat): MarkdownChange {
  const selected = document.slice(from, to);
  const change = (insert: string, selectionStart = 0, selectionEnd = insert.length): MarkdownChange => ({
    from, to, insert, selectionStart, selectionEnd,
  });
  const wrap = (before: string, after: string, placeholder: string) => {
    const body = selected || placeholder;
    const insert = `${before}${body}${after}`;
    return selected ? change(insert) : change(insert, before.length, before.length + body.length);
  };
  const prefixLines = (prefix: (index: number) => string, placeholder: string) => {
    const body = selected || placeholder;
    const insert = body.split(/\r?\n/).map((line, index) => `${prefix(index)}${line}`).join("\n");
    return selected ? change(insert) : change(insert, prefix(0).length, insert.length);
  };

  switch (format) {
    case "heading": return prefixLines(() => "# ", "Heading");
    case "bold": return wrap("**", "**", "bold text");
    case "italic": return wrap("_", "_", "italic text");
    case "strikethrough": return wrap("~~", "~~", "strikethrough text");
    case "link": return wrap("[", "](https://example.com)", "link text");
    case "bulletList": return prefixLines(() => "- ", "List item");
    case "numberedList": return prefixLines((index) => `${index + 1}. `, "List item");
    case "taskList": return prefixLines(() => "- [ ] ", "Task");
    case "quote": return prefixLines(() => "> ", "Quote");
    case "inlineCode": return wrap("`", "`", "code");
    case "codeBlock": return wrap("```\n", "\n```", "code");
    case "table": {
      const insert = "| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |";
      return change(insert, 2, 10);
    }
    case "mermaid": {
      const body = selected || "flowchart TD\n    A[Start] --> B[End]";
      const before = "```mermaid\n";
      const insert = `${before}${body}\n\`\`\``;
      return selected ? change(insert) : change(insert, before.length, before.length + body.length);
    }
  }
}
