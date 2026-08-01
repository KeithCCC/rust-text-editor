import { describe, expect, it } from "vitest";
import { parseRecentFiles, removeRecentFile, updateRecentFiles } from "./recentFiles";

describe("recent files", () => {
  it("moves a reopened Windows path to the front without duplicating it", () => {
    const history = [
      { path: "C:\\notes\\first.md", lastAccessedAt: 1 },
      { path: "C:\\notes\\second.md", lastAccessedAt: 2 },
    ];

    expect(updateRecentFiles(history, "c:\\NOTES\\first.md", 3)).toEqual([
      { path: "c:\\NOTES\\first.md", lastAccessedAt: 3 },
      { path: "C:\\notes\\second.md", lastAccessedAt: 2 },
    ]);
  });

  it("keeps only the ten most recent paths", () => {
    const history = Array.from({ length: 10 }, (_, index) => ({ path: `${index}.md`, lastAccessedAt: index }));
    const updated = updateRecentFiles(history, "new.md", 20);

    expect(updated).toHaveLength(10);
    expect(updated[0].path).toBe("new.md");
    expect(updated.some((entry) => entry.path === "9.md")).toBe(false);
  });

  it("treats malformed persisted data as an empty history", () => {
    expect(parseRecentFiles("not json")).toEqual([]);
    expect(parseRecentFiles('[{"path":42}]')).toEqual([]);
  });

  it("removes an inaccessible recent path without removing the remaining history", () => {
    expect(removeRecentFile([
      { path: "C:\\notes\\missing.md", lastAccessedAt: 2 },
      { path: "C:\\notes\\keep.md", lastAccessedAt: 1 },
    ], "c:/NOTES/missing.md")).toEqual([
      { path: "C:\\notes\\keep.md", lastAccessedAt: 1 },
    ]);
  });
});
