import { describe, expect, it } from "vitest";
import { parseMarkdownOutline } from "./markdownOutline";

describe("parseMarkdownOutline", () => {
  it("returns ATX headings through level six with source offsets", () => {
    const markdown = "# Title\ntext\n### Details\n###### End";
    expect(parseMarkdownOutline(markdown)).toEqual([
      { id: "markdown-heading-0", level: 1, text: "Title", offset: 0 },
      { id: "markdown-heading-13", level: 3, text: "Details", offset: 13 },
      { id: "markdown-heading-25", level: 6, text: "End", offset: 25 },
    ]);
  });

  it("ignores heading-like text inside fenced code blocks", () => {
    const markdown = "# Visible\n```md\n## Hidden\n```\n## Also visible";
    expect(parseMarkdownOutline(markdown).map((heading) => heading.text)).toEqual(["Visible", "Also visible"]);
  });

  it("keeps content hashes unless whitespace starts a CommonMark closing sequence", () => {
    const markdown = "# C#\n# Heading ###\n# Also heading ###   ";
    expect(parseMarkdownOutline(markdown).map((heading) => heading.text)).toEqual([
      "C#",
      "Heading",
      "Also heading",
    ]);
  });

  it("uses distinct source-offset IDs for duplicate headings with LF and CRLF", () => {
    expect(parseMarkdownOutline("# Same\n# Same").map((heading) => heading.id)).toEqual([
      "markdown-heading-0",
      "markdown-heading-7",
    ]);
    expect(parseMarkdownOutline("# Same\r\n# Same").map((heading) => heading.id)).toEqual([
      "markdown-heading-0",
      "markdown-heading-8",
    ]);
  });
});
