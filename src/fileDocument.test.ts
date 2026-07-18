import { describe, expect, test } from "vitest";
import { createUntitledDocument, defaultSaveAsPath, formatDocumentTitle } from "./fileDocument";

describe("file document behavior", () => {
  test("creates a blank untitled document", () => {
    expect(createUntitledDocument()).toEqual({
      content: "",
      path: null,
      modified: false,
    });
  });

  test("formats titles with the canonical Koharu product name", () => {
    expect(formatDocumentTitle(null, false)).toBe("Untitled - Koharu");
    expect(formatDocumentTitle("C:\\notes\\todo.md", false)).toBe("todo.md - Koharu");
    expect(formatDocumentTitle("C:\\notes\\todo.md", true)).toBe("*todo.md - Koharu");
  });

  test("defaults new files to markdown when saving as", () => {
    expect(defaultSaveAsPath(null)).toBe("Untitled.md");
    expect(defaultSaveAsPath("C:\\notes\\todo.txt")).toBe("C:\\notes\\todo.txt");
  });
});
