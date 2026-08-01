import { describe, expect, it } from "vitest";
import { getFormattingUi } from "./formattingUi";
import { detectFormattingContext, formatMarkdownSelection } from "./markdownFormatting";

describe("formatMarkdownSelection", () => {
  it("toggles bold delimiters without stacking them", () => {
    expect(formatMarkdownSelection("Koharu", { from: 0, to: 6 }, { kind: "bold" }).insert).toBe("**Koharu**");
    expect(formatMarkdownSelection("**Koharu**", { from: 2, to: 8 }, { kind: "bold" })).toMatchObject({
      from: 0,
      to: 10,
      insert: "Koharu",
    });
  });

  it("uses asterisk emphasis inside uninterrupted CJK prose", () => {
    expect(formatMarkdownSelection("日本語文章", { from: 1, to: 3 }, { kind: "italic" })).toMatchObject({
      from: 1,
      to: 3,
      insert: "*本語*",
    });
  });

  it("reverses valid asterisk and underscore emphasis variants", () => {
    expect(formatMarkdownSelection("*Koharu*", { from: 1, to: 7 }, { kind: "italic" })).toMatchObject({
      from: 0,
      to: 8,
      insert: "Koharu",
    });
    expect(formatMarkdownSelection("_Koharu_", { from: 1, to: 7 }, { kind: "italic" })).toMatchObject({
      from: 0,
      to: 8,
      insert: "Koharu",
    });
    expect(formatMarkdownSelection("__Koharu__", { from: 2, to: 8 }, { kind: "bold" })).toMatchObject({
      from: 0,
      to: 10,
      insert: "Koharu",
    });
  });

  it("does not remove literal intraword delimiters and avoids escaped asterisk runs", () => {
    expect(formatMarkdownSelection("foo_bar_baz", { from: 4, to: 7 }, { kind: "italic" })).toMatchObject({
      from: 4,
      to: 7,
      insert: "*bar*",
    });
    expect(formatMarkdownSelection("\\*bar\\*", { from: 2, to: 5 }, { kind: "italic" })).toMatchObject({
      from: 2,
      to: 5,
      insert: "_bar_",
    });
  });

  it("uses a longer inline-code delimiter when the selection contains a backtick", () => {
    expect(formatMarkdownSelection("a`b", { from: 0, to: 3 }, { kind: "inlineCode" }).insert).toBe("``a`b``");
  });

  it("pads adaptive code spans that start or end with backticks", () => {
    expect(formatMarkdownSelection("`edge`", { from: 0, to: 6 }, { kind: "inlineCode" }).insert)
      .toBe("`` `edge` ``");
    expect(formatMarkdownSelection("`edge", { from: 0, to: 5 }, { kind: "inlineCode" }).insert)
      .toBe("`` `edge ``");
  });

  it("pads symmetric spaces so CommonMark preserves them as code content", () => {
    expect(formatMarkdownSelection(" code ", { from: 0, to: 6 }, { kind: "inlineCode" }).insert)
      .toBe("`  code  `");
  });

  it("removes an adaptive inline-code delimiter without losing inner backticks", () => {
    expect(formatMarkdownSelection("``a`b``", { from: 2, to: 5 }, { kind: "inlineCode" })).toMatchObject({
      from: 0,
      to: 7,
      insert: "a`b",
    });
  });

  it("reverses a generated padded code span without keeping padding", () => {
    expect(formatMarkdownSelection("`` `edge` ``", { from: 3, to: 9 }, { kind: "inlineCode" })).toMatchObject({
      from: 0,
      to: 12,
      insert: "`edge`",
      selectionStart: 0,
      selectionEnd: 6,
    });
  });

  it("rejects multiline inline code without replacing the selection", () => {
    expect(formatMarkdownSelection("one\r\ntwo", { from: 0, to: 8 }, { kind: "inlineCode" })).toMatchObject({
      from: 0,
      to: 8,
      insert: "one\r\ntwo",
      warning: "multilineInlineCode",
    });
  });

  it("uses one link contract for selected and placeholder text", () => {
    expect(formatMarkdownSelection("Koharu", { from: 0, to: 6 }, { kind: "link" })).toMatchObject({
      insert: "[Koharu](https://example.com)",
      selectionStart: 9,
      selectionEnd: 28,
    });
    expect(formatMarkdownSelection("", { from: 0, to: 0 }, { kind: "link" })).toMatchObject({
      insert: "[link text](https://example.com)",
      selectionStart: 1,
      selectionEnd: 10,
    });
  });

  it("detects the active heading and inline wrapper at the caret", () => {
    expect(detectFormattingContext("## **Heading**", { from: 7, to: 7 })).toEqual({
      headingLevel: 2,
      bold: true,
      italic: false,
      strikethrough: false,
      inlineCode: false,
    });
  });

  it("detects CommonMark emphasis variants in safe CJK and boundary contexts", () => {
    expect(detectFormattingContext("日本*語*文章", { from: 3, to: 3 }).italic).toBe(true);
    expect(detectFormattingContext("日本 _語_ 文章", { from: 4, to: 4 }).italic).toBe(true);
    expect(detectFormattingContext("日本 __語__ 文章", { from: 5, to: 5 }).bold).toBe(true);
  });

  it("does not infer bold formatting between separate bold spans", () => {
    expect(detectFormattingContext("**one** plain **two**", { from: 10, to: 10 })).toEqual({
      headingLevel: null,
      bold: false,
      italic: false,
      strikethrough: false,
      inlineCode: false,
    });
  });

  it("does not carry a bold opener past an unrecognized closer", () => {
    expect(detectFormattingContext("**bold**plain**", { from: 10, to: 10 }).bold).toBe(false);
  });

  it("does not infer inline code between separate code spans", () => {
    expect(detectFormattingContext("`three` gap `four`", { from: 9, to: 9 }).inlineCode).toBe(false);
  });

  it("does not infer inline wrappers from literal delimiters inside code", () => {
    expect(detectFormattingContext("`**literal**`", { from: 6, to: 6 })).toEqual({
      headingLevel: null,
      bold: false,
      italic: false,
      strikethrough: false,
      inlineCode: true,
    });
  });

  it("does not infer italic formatting from intraword underscores", () => {
    expect(detectFormattingContext("foo_bar_baz", { from: 7, to: 7 }).italic).toBe(false);
  });

  it("does not infer bold or italic formatting from unsafe literal delimiters", () => {
    expect(detectFormattingContext("foo__bar__baz", { from: 7, to: 7 }).bold).toBe(false);
    expect(detectFormattingContext("\\*bar\\*", { from: 3, to: 3 }).italic).toBe(false);
  });

  it("finds valid inline code after an unmatched delimiter run", () => {
    expect(detectFormattingContext("``oops `valid`", { from: 10, to: 10 }).inlineCode).toBe(true);
  });

  it("prefixes each selected line as a task list", () => {
    expect(formatMarkdownSelection("One\nTwo", { from: 0, to: 7 }, { kind: "taskList" }).insert).toBe("- [ ] One\n- [ ] Two");
  });

  it("preserves CRLF when prefixing selected lines", () => {
    expect(formatMarkdownSelection("One\r\nTwo", { from: 0, to: 8 }, { kind: "taskList" }).insert).toBe("- [ ] One\r\n- [ ] Two");
  });

  it("expands a partial selection to complete lines before making a task list", () => {
    const document = "Alpha\r\nBeta\r\nGamma";
    expect(formatMarkdownSelection(document, { from: 8, to: 10 }, { kind: "taskList" })).toMatchObject({
      from: 7,
      to: 11,
      insert: "- [ ] Beta",
    });
  });

  it("does not include the next LF line when the selection ends after the newline", () => {
    expect(formatMarkdownSelection("One\nTwo", { from: 0, to: 4 }, { kind: "taskList" })).toMatchObject({
      from: 0,
      to: 3,
      insert: "- [ ] One",
    });
  });

  it("does not include the next CRLF line when the selection ends after the newline", () => {
    expect(formatMarkdownSelection("One\r\nTwo", { from: 0, to: 5 }, { kind: "taskList" })).toMatchObject({
      from: 0,
      to: 3,
      insert: "- [ ] One",
    });
  });

  it("keeps a caret on an empty first line at offset zero", () => {
    expect(formatMarkdownSelection("\nTwo", { from: 0, to: 0 }, { kind: "taskList" })).toMatchObject({
      from: 0,
      to: 0,
      insert: "- [ ] Task",
    });
  });

  it("replaces an existing heading level instead of stacking markers", () => {
    expect(formatMarkdownSelection("## Heading", { from: 4, to: 8 }, { kind: "heading", level: 3 }).insert).toBe("### Heading");
  });

  it("toggles matching line markers and replaces other line markers", () => {
    expect(formatMarkdownSelection("- One\n- Two", { from: 0, to: 11 }, { kind: "bulletList" }).insert).toBe("One\nTwo");
    expect(formatMarkdownSelection("> One\n> Two", { from: 0, to: 11 }, { kind: "numberedList" }).insert).toBe("1. One\n2. Two");
    expect(formatMarkdownSelection("1. One\n2. Two", { from: 0, to: 13 }, { kind: "taskList" }).insert).toBe("- [ ] One\n- [ ] Two");
    expect(formatMarkdownSelection("- [x] One", { from: 0, to: 9 }, { kind: "quote" }).insert).toBe("> One");
  });

  it("adds safe LF block boundaries around a code block inserted mid-line", () => {
    expect(formatMarkdownSelection("beforeafter", { from: 6, to: 6 }, { kind: "codeBlock", language: "rust" }).insert).toBe(
      "\n\n```rust\ncode\n```\n\n",
    );
  });

  it("preserves CRLF in safe code-block boundaries", () => {
    expect(formatMarkdownSelection("before\r\nafter", { from: 8, to: 8 }, { kind: "codeBlock", language: "rust" }).insert).toBe(
      "\r\n```rust\r\ncode\r\n```\r\n\r\n",
    );
  });

  it("uses a longer fence when selected code contains triple backticks", () => {
    expect(formatMarkdownSelection("```\ninner\n```", { from: 0, to: 13 }, { kind: "codeBlock", language: "markdown" }).insert).toContain("````markdown");
  });

  it("uses adaptive fences and safe boundaries for Mermaid selections", () => {
    expect(formatMarkdownSelection("beforeafter", { from: 6, to: 6 }, { kind: "mermaid" }).insert).toBe(
      "\n\n```mermaid\nflowchart TD\n    A[Start] --> B[End]\n```\n\n",
    );
    expect(formatMarkdownSelection("```\nA --> B", { from: 0, to: 11 }, { kind: "mermaid" }).insert).toContain("````mermaid");
  });

  it("converts tab-separated selected rows into a non-destructive table", () => {
    expect(formatMarkdownSelection("Name\tValue\nA\t1", { from: 0, to: 14 }, { kind: "table" }).insert).toBe(
      "| Name | Value |\n| --- | --- |\n| A | 1 |",
    );
  });

  it("falls back non-destructively when any non-empty selected row is not TSV", () => {
    const selected = "Name\tValue\nKeep this prose";
    expect(formatMarkdownSelection(selected, { from: 0, to: selected.length }, { kind: "table" }).insert).toBe(
      `${selected}\n\n| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |`,
    );
  });

  it("falls back non-destructively when the TSV selection includes its trailing newline", () => {
    const selected = "Name\tValue\nA\t1\n";
    expect(formatMarkdownSelection(selected, { from: 0, to: selected.length }, { kind: "table" }).insert).toBe(
      `${selected}\n| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |`,
    );
  });

  it("escapes table-cell pipes and backslashes without changing LF", () => {
    const selected = "Name\tPath\nA|B\tC\\D";
    expect(formatMarkdownSelection(selected, { from: 0, to: selected.length }, { kind: "table" }).insert).toBe(
      "| Name | Path |\n| --- | --- |\n| A\\|B | C\\\\D |",
    );
  });

  it("preserves source EOL while converting tab-separated rows", () => {
    expect(formatMarkdownSelection("Name\tValue\r\nA\t1", { from: 0, to: 15 }, { kind: "table" }).insert).toBe(
      "| Name | Value |\r\n| --- | --- |\r\n| A | 1 |",
    );
  });

  it("preserves a non-tabular selection and inserts the table after it", () => {
    const result = formatMarkdownSelection("Keep me", { from: 0, to: 7 }, { kind: "table" });
    expect(result.insert).toContain("Keep me");
    expect(result.insert).toContain("| Column 1 | Column 2 |");
  });

  it("selects the inserted table heading when preserved prose contains the same placeholder", () => {
    const selected = "Keep Column 1 here";
    const result = formatMarkdownSelection(selected, { from: 0, to: selected.length }, { kind: "table" });

    expect(result.selectionStart).toBeGreaterThan(selected.length);
    expect(result.insert.slice(result.selectionStart, result.selectionEnd)).toBe("Column 1");
  });

  it("inserts a complete Mermaid placeholder", () => {
    const result = formatMarkdownSelection("", { from: 0, to: 0 }, { kind: "mermaid" });
    expect(result.insert).toBe("```mermaid\nflowchart TD\n    A[Start] --> B[End]\n```");
    expect(result.insert.slice(result.selectionStart, result.selectionEnd)).toBe("flowchart TD\n    A[Start] --> B[End]");
  });

  it("uses one supplied Japanese placeholder contract across formatting commands", () => {
    const placeholders = getFormattingUi("ja").placeholders;
    const insert = (command: Parameters<typeof formatMarkdownSelection>[2]) => (
      formatMarkdownSelection("", { from: 0, to: 0 }, command, placeholders).insert
    );

    expect(insert({ kind: "bold" })).toBe("**太字**");
    expect(insert({ kind: "italic" })).toBe("*斜体*");
    expect(insert({ kind: "strikethrough" })).toBe("~~取り消し線~~");
    expect(insert({ kind: "link" })).toBe("[リンク](https://example.com)");
    expect(insert({ kind: "inlineCode" })).toBe("`コード`");
    expect(insert({ kind: "heading", level: 2 })).toBe("## 見出し");
    expect(insert({ kind: "bulletList" })).toBe("- リスト項目");
    expect(insert({ kind: "numberedList" })).toBe("1. リスト項目");
    expect(insert({ kind: "taskList" })).toBe("- [ ] タスク");
    expect(insert({ kind: "quote" })).toBe("> 引用");
    expect(insert({ kind: "codeBlock", language: "" })).toBe("```\nコード\n```");
    expect(insert({ kind: "table" })).toBe("| 列 1 | 列 2 |\n| --- | --- |\n| 値 1 | 値 2 |");
    expect(insert({ kind: "mermaid" })).toBe("```mermaid\nflowchart TD\n    A[開始] --> B[終了]\n```");
  });
});
