import { describe, expect, it } from "vitest";
import { formatMarkdownSelection } from "./markdownFormatting";

describe("formatMarkdownSelection", () => {
  it("wraps selected text and keeps the formatted text selected", () => {
    expect(formatMarkdownSelection("Koharu", 0, 6, "bold")).toEqual({
      from: 0,
      to: 6,
      insert: "**Koharu**",
      selectionStart: 0,
      selectionEnd: 10,
    });
  });

  it("inserts a link placeholder and selects only the editable label", () => {
    expect(formatMarkdownSelection("", 0, 0, "link")).toEqual({
      from: 0,
      to: 0,
      insert: "[link text](https://example.com)",
      selectionStart: 1,
      selectionEnd: 10,
    });
  });

  it("prefixes each selected line as a task list", () => {
    expect(formatMarkdownSelection("One\nTwo", 0, 7, "taskList").insert).toBe("- [ ] One\n- [ ] Two");
  });

  it("inserts a complete Mermaid placeholder", () => {
    const result = formatMarkdownSelection("", 0, 0, "mermaid");
    expect(result.insert).toBe("```mermaid\nflowchart TD\n    A[Start] --> B[End]\n```");
    expect(result.insert.slice(result.selectionStart, result.selectionEnd)).toBe("flowchart TD\n    A[Start] --> B[End]");
  });
});
