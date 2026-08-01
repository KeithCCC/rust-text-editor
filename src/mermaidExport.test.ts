import { describe, expect, it } from "vitest";
import { buildMermaidExportFileName, buildMermaidRenderConfig, prepareSvgExport } from "./mermaidExport";

describe("Mermaid export", () => {
  it("builds a timestamped file name", () => {
    expect(buildMermaidExportFileName(new Date("2026-08-01T04:20:00"), "svg")).toBe("mermaid-diagram-20260801-0420.svg");
  });

  it("adds the SVG namespace without changing the rendered content", () => {
    expect(prepareSvgExport('<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0"/></svg>',
    );
  });

  it("uses SVG text labels so native PNG export does not taint the canvas", () => {
    expect(buildMermaidRenderConfig({ primaryColor: "#123456" })).toMatchObject({
      htmlLabels: false,
      themeVariables: { primaryColor: "#123456" },
    });
  });
});
