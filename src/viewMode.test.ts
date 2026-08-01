import { describe, expect, it } from "vitest";
import { resolvePaneVisibility } from "./responsiveLayout";
import { cycleViewMode, resolveViewMode } from "./viewMode";

describe("view mode", () => {
  it("restores all supported modes and falls back to edit", () => {
    expect(resolveViewMode("edit")).toBe("edit");
    expect(resolveViewMode("split")).toBe("split");
    expect(resolveViewMode("preview")).toBe("preview");
    expect(resolveViewMode("source")).toBe("edit");
    expect(resolveViewMode("unexpected")).toBe("edit");
  });

  it("cycles through edit, split, and preview", () => {
    expect(cycleViewMode("edit")).toBe("split");
    expect(cycleViewMode("split")).toBe("preview");
    expect(cycleViewMode("preview")).toBe("edit");
  });

  it("keeps the editor mounted while hiding it in preview mode", () => {
    expect(resolvePaneVisibility("preview")).toEqual({
      editorMounted: true,
      editorVisible: false,
      previewVisible: true,
    });
  });
});
