import { describe, expect, it } from "vitest";
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

  it("uses a longer inline-code delimiter when the selection contains a backtick", () => {
    expect(formatMarkdownSelection("a`b", { from: 0, to: 3 }, { kind: "inlineCode" }).insert).toBe("``a`b``");
  });

  it("removes an adaptive inline-code delimiter without losing inner backticks", () => {
    expect(formatMarkdownSelection("``a`b``", { from: 2, to: 5 }, { kind: "inlineCode" })).toMatchObject({
      from: 0,
      to: 7,
      insert: "a`b",
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

  it("does not infer bold formatting between separate bold spans", () => {
    expect(detectFormattingContext("**one** plain **two**", { from: 10, to: 10 })).toEqual({
      headingLevel: null,
      bold: false,
      italic: false,
      strikethrough: false,
      inlineCode: false,
    });
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

  it("finds valid inline code after an unmatched delimiter run", () => {
    expect(detectFormattingContext("``oops `valid`", { from: 10, to: 10 }).inlineCode).toBe(true);
  });

  it("prefixes each selected line as a task list", () => {
    expect(formatMarkdownSelection("One\nTwo", { from: 0, to: 7 }, { kind: "taskList" }).insert).toBe("- [ ] One\n- [ ] Two");
  });

  it("preserves CRLF when prefixing selected lines", () => {
    expect(formatMarkdownSelection("One\r\nTwo", { from: 0, to: 8 }, { kind: "taskList" }).insert).toBe("- [ ] One\r\n- [ ] Two");
  });

  it("inserts a complete Mermaid placeholder", () => {
    const result = formatMarkdownSelection("", { from: 0, to: 0 }, { kind: "mermaid" });
    expect(result.insert).toBe("```mermaid\nflowchart TD\n    A[Start] --> B[End]\n```");
    expect(result.insert.slice(result.selectionStart, result.selectionEnd)).toBe("flowchart TD\n    A[Start] --> B[End]");
  });
});
