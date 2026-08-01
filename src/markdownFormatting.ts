export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type CodeLanguage =
  | ""
  | "markdown"
  | "javascript"
  | "typescript"
  | "json"
  | "rust"
  | "bash"
  | "powershell";

export type MarkdownCommand =
  | { kind: "bold" | "italic" | "strikethrough" | "link" | "inlineCode" }
  | { kind: "heading"; level: HeadingLevel }
  | { kind: "bulletList" | "numberedList" | "taskList" | "quote" | "table" | "mermaid" }
  | { kind: "codeBlock"; language: CodeLanguage };

export type FormatSelection = { from: number; to: number };

export type FormatResult = {
  from: number;
  to: number;
  insert: string;
  selectionStart: number;
  selectionEnd: number;
  feedback?: "codeBlockInserted" | "tableInserted" | "mermaidInserted";
  warning?: "multilineInlineCode";
};

export type FormattingContext = {
  headingLevel: HeadingLevel | null;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  inlineCode: boolean;
};

function detectEol(document: string): "\r\n" | "\n" {
  return document.includes("\r\n") ? "\r\n" : "\n";
}

function inlineDelimiter(content: string) {
  const longest = Math.max(0, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length));
  return "`".repeat(longest + 1);
}

function toggleWrapper(
  document: string,
  selection: FormatSelection,
  before: string,
  after: string,
  placeholder: string,
): FormatResult {
  const selected = document.slice(selection.from, selection.to);
  const outerFrom = selection.from - before.length;
  const outerTo = selection.to + after.length;
  if (
    outerFrom >= 0
    && document.slice(outerFrom, selection.from) === before
    && document.slice(selection.to, outerTo) === after
  ) {
    return {
      from: outerFrom,
      to: outerTo,
      insert: selected,
      selectionStart: 0,
      selectionEnd: selected.length,
    };
  }
  const body = selected || placeholder;
  const insert = `${before}${body}${after}`;
  return {
    from: selection.from,
    to: selection.to,
    insert,
    selectionStart: before.length,
    selectionEnd: before.length + body.length,
  };
}

export function formatMarkdownSelection(
  document: string,
  selection: FormatSelection,
  command: MarkdownCommand,
): FormatResult {
  const selected = document.slice(selection.from, selection.to);
  const eol = detectEol(document);
  const change = (
    insert: string,
    selectionStart = 0,
    selectionEnd = insert.length,
    metadata: Pick<FormatResult, "feedback" | "warning"> = {},
  ): FormatResult => ({
    from: selection.from,
    to: selection.to,
    insert,
    selectionStart,
    selectionEnd,
    ...metadata,
  });
  const prefixLines = (prefix: (index: number) => string, placeholder: string) => {
    const body = selected || placeholder;
    const insert = body
      .split(/\r\n|\n/)
      .map((line, index) => `${prefix(index)}${line}`)
      .join(eol);
    return selected ? change(insert) : change(insert, prefix(0).length, insert.length);
  };

  switch (command.kind) {
    case "bold":
      return toggleWrapper(document, selection, "**", "**", "bold text");
    case "italic":
      return toggleWrapper(document, selection, "_", "_", "italic text");
    case "strikethrough":
      return toggleWrapper(document, selection, "~~", "~~", "strikethrough text");
    case "link": {
      const result = toggleWrapper(document, selection, "[", "](https://example.com)", "link text");
      if (result.from !== selection.from || result.to !== selection.to || !selected) {
        return result;
      }
      const urlStart = selected.length + 3;
      return {
        ...result,
        selectionStart: urlStart,
        selectionEnd: urlStart + "https://example.com".length,
      };
    }
    case "inlineCode": {
      if (/[\r\n]/.test(selected)) {
        return change(selected, 0, selected.length, { warning: "multilineInlineCode" });
      }
      const delimiter = inlineDelimiter(selected);
      return toggleWrapper(document, selection, delimiter, delimiter, "code");
    }
    case "heading":
      return prefixLines(() => `${"#".repeat(command.level)} `, "Heading");
    case "bulletList":
      return prefixLines(() => "- ", "List item");
    case "numberedList":
      return prefixLines((index) => `${index + 1}. `, "List item");
    case "taskList":
      return prefixLines(() => "- [ ] ", "Task");
    case "quote":
      return prefixLines(() => "> ", "Quote");
    case "codeBlock": {
      const before = `\`\`\`${command.language}${eol}`;
      const body = selected || "code";
      const insert = `${before}${body}${eol}\`\`\``;
      return change(
        insert,
        before.length,
        before.length + body.length,
        { feedback: "codeBlockInserted" },
      );
    }
    case "table": {
      const insert = `| Column 1 | Column 2 |${eol}| --- | --- |${eol}| Value 1 | Value 2 |`;
      return change(insert, 2, 10, { feedback: "tableInserted" });
    }
    case "mermaid": {
      const body = selected || `flowchart TD${eol}    A[Start] --> B[End]`;
      const before = `\`\`\`mermaid${eol}`;
      const insert = `${before}${body}${eol}\`\`\``;
      return change(
        insert,
        before.length,
        before.length + body.length,
        { feedback: "mermaidInserted" },
      );
    }
  }
}

const emptyFormattingContext = (): FormattingContext => ({
  headingLevel: null,
  bold: false,
  italic: false,
  strikethrough: false,
  inlineCode: false,
});

function isSurrounded(
  line: string,
  from: number,
  to: number,
  delimiter: string,
): boolean {
  const delimiters: number[] = [];
  let offset = line.indexOf(delimiter);
  while (offset >= 0) {
    delimiters.push(offset);
    offset = line.indexOf(delimiter, offset + delimiter.length);
  }

  if (delimiters.length % 2 !== 0) {
    return false;
  }
  for (let index = 0; index < delimiters.length; index += 2) {
    if (delimiters[index] + delimiter.length <= from && delimiters[index + 1] >= to) {
      return true;
    }
  }
  return false;
}

function hasInlineCodeAround(line: string, from: number, to: number): boolean {
  const runs = Array.from(line.matchAll(/`+/g), (match) => ({
    from: match.index,
    to: match.index + match[0].length,
    length: match[0].length,
  }));

  for (let index = 0; index < runs.length;) {
    const left = runs[index];
    const relativeClose = runs.slice(index + 1).findIndex((right) => right.length === left.length);
    if (relativeClose < 0) {
      return false;
    }
    const closeIndex = index + relativeClose + 1;
    const right = runs[closeIndex];
    if (left.to <= from && right.from >= to) {
      return true;
    }
    index = closeIndex + 1;
  }
  return false;
}

export function detectFormattingContext(
  document: string,
  selection: FormatSelection,
): FormattingContext {
  if (
    selection.from < 0
    || selection.to < selection.from
    || selection.to > document.length
    || /[\r\n]/.test(document.slice(selection.from, selection.to))
  ) {
    return emptyFormattingContext();
  }

  const lineStart = document.lastIndexOf("\n", selection.from - 1) + 1;
  const nextLineBreak = document.indexOf("\n", selection.to);
  const rawLineEnd = nextLineBreak < 0 ? document.length : nextLineBreak;
  const lineEnd = rawLineEnd > lineStart && document[rawLineEnd - 1] === "\r"
    ? rawLineEnd - 1
    : rawLineEnd;
  if (selection.to > lineEnd) {
    return emptyFormattingContext();
  }

  const line = document.slice(lineStart, lineEnd);
  const relativeFrom = selection.from - lineStart;
  const relativeTo = selection.to - lineStart;
  const heading = /^(#{1,6})\s/.exec(line);

  return {
    headingLevel: heading ? heading[1].length as HeadingLevel : null,
    bold: isSurrounded(line, relativeFrom, relativeTo, "**"),
    italic: isSurrounded(line, relativeFrom, relativeTo, "_"),
    strikethrough: isSurrounded(line, relativeFrom, relativeTo, "~~"),
    inlineCode: hasInlineCodeAround(line, relativeFrom, relativeTo),
  };
}
