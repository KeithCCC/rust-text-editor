import { describe, expect, it } from "vitest";
import { buildMermaidExportFileName, prepareSvgExport } from "./mermaidExport";

describe("Mermaid export", () => {
  it("builds a timestamped file name", () => {
    expect(buildMermaidExportFileName(new Date("2026-08-01T04:20:00"), "svg")).toBe("mermaid-diagram-20260801-0420.svg");
  });

  it("adds the SVG namespace without changing the rendered content", () => {
    expect(prepareSvgExport('<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0"/></svg>',
    );
  });
});
