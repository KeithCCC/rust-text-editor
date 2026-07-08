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

  test("formats titles like a simple file editor", () => {
    expect(formatDocumentTitle(null, false)).toBe("Untitled - Koharu markdown editor");
    expect(formatDocumentTitle("C:\\notes\\todo.txt", false)).toBe("todo.txt - Koharu markdown editor");
    expect(formatDocumentTitle("C:\\notes\\todo.txt", true)).toBe("*todo.txt - Koharu markdown editor");
  });

  test("defaults new files to markdown when saving as", () => {
    expect(defaultSaveAsPath(null)).toBe("Untitled.md");
    expect(defaultSaveAsPath("C:\\notes\\todo.txt")).toBe("C:\\notes\\todo.txt");
  });
});
