import { describe, expect, it } from "vitest";
import { parseMarkdownOutline } from "./markdownOutline";

describe("parseMarkdownOutline", () => {
  it("returns ATX headings through level six with source offsets", () => {
    const markdown = "# Title\ntext\n### Details\n###### End";
    expect(parseMarkdownOutline(markdown)).toEqual([
      { level: 1, text: "Title", offset: 0, index: 0 },
      { level: 3, text: "Details", offset: 13, index: 1 },
      { level: 6, text: "End", offset: 25, index: 2 },
    ]);
  });

  it("ignores heading-like text inside fenced code blocks", () => {
    const markdown = "# Visible\n```md\n## Hidden\n```\n## Also visible";
    expect(parseMarkdownOutline(markdown).map((heading) => heading.text)).toEqual(["Visible", "Also visible"]);
  });
});
