import { describe, expect, it } from "vitest";
import { getRelativeMarkdownPath } from "./markdownLinks";

describe("getRelativeMarkdownPath", () => {
  it("returns relative Markdown document paths", () => {
    expect(getRelativeMarkdownPath("notes/plan.md")).toBe("notes/plan.md");
    expect(getRelativeMarkdownPath("../archive/plan.markdown#summary")).toBe("../archive/plan.markdown");
  });

  it("decodes URL-encoded relative paths", () => {
    expect(getRelativeMarkdownPath("Meeting%20Notes.md")).toBe("Meeting Notes.md");
  });

  it("rejects external, absolute, anchor, and non-Markdown links", () => {
    expect(getRelativeMarkdownPath("https://example.com/plan.md")).toBeNull();
    expect(getRelativeMarkdownPath("C:\\notes\\plan.md")).toBeNull();
    expect(getRelativeMarkdownPath("/notes/plan.md")).toBeNull();
    expect(getRelativeMarkdownPath("#summary")).toBeNull();
    expect(getRelativeMarkdownPath("diagram.excalidraw")).toBeNull();
  });
});
