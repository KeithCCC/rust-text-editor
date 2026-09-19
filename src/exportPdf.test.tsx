// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPdfHtml, waitForPdfDiagrams } from "./exportPdf";
import { exportToSvg } from "@excalidraw/excalidraw";
import { invoke } from "@tauri-apps/api/core";

vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), render: vi.fn(async () => ({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Diagram ready</text></svg>' })) } }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async (command: string) => {
  if (command === "read_pdf_image") return "data:image/png;base64,aGVsbG8=";
  if (command === "resolve_relative_path") return "C:/notes/diagram.excalidraw";
  if (command === "read_excalidraw_file") return '{"elements":[]}';
}) }));
vi.mock("@excalidraw/excalidraw", () => ({ exportToSvg: vi.fn(async () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = "<text>Sketch ready</text>";
  return svg;
}) }));

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ""; });

describe("PDF snapshot", () => {
  it("preserves Japanese, GFM tables, task lists and unsaved content with escaped metadata", async () => {
    const html = await createPdfHtml({ content: "# 日本語\n\n| A | B |\n|---|---|\n| one | two |\n\n- [x] 完了", currentFile: null, title: "<draft>", language: "ja" });
    expect(html).toContain("日本語");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("&lt;draft&gt;");
    expect(document.querySelector("[data-pdf-stage]")).toBeNull();
  });
  it("removes active raw HTML before staging and snapshotting", async () => {
    const html = await createPdfHtml({ content: '<iframe src="https://evil.test"></iframe><script>alert(1)</script><p onclick="alert(1)" style="background:url(https://evil.test)">safe</p>', currentFile: null, title: "Safe", language: "en" });
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script");
    expect(html).toContain("safe");
  });
  it("preserves text inside nested safe raw HTML containers while removing dangerous subtrees", async () => {
    const html = await createPdfHtml({ content: '<main><section><article><figure><figcaption>残す本文</figcaption><custom-wrapper><p>ネストした本文</p></custom-wrapper></figure></article></section><iframe><p>危険な代替内容</p></iframe><script>unsafe()</script></main>', currentFile: null, title: "Containers", language: "ja" });
    expect(html).toContain("残す本文");
    expect(html).toContain("ネストした本文");
    expect(html).not.toContain("危険な代替内容");
    expect(html).not.toContain("unsafe()");
    expect(html).not.toContain("<custom-wrapper");
  });
  it("reports unavailable remote images rather than exporting missing content", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("offline"));
    await expect(createPdfHtml({ content: "![photo](https://example.test/image.png)", currentFile: null, title: "Images", language: "en" })).rejects.toThrow(/image/i);
    expect(document.querySelector("[data-pdf-stage]")).toBeNull();
  });
  it("loads remote images through the backend without depending on WebView CORS", async () => {
    const html = await createPdfHtml({ content: "![remote](https://example.test/image.png)", currentFile: null, title: "Remote", language: "en" });
    expect(invoke).toHaveBeenCalledWith("read_pdf_image", { currentFile: null, src: "https://example.test/image.png" });
    expect(html).toContain('src="data:image/png;base64,aGVsbG8="');
  });
  it("rejects diagrams that failed or never finish", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-pdf-status="error">Invalid diagram</div>';
    await expect(waitForPdfDiagrams(root, 20)).rejects.toThrow("Invalid diagram");
    root.innerHTML = '<div data-pdf-status="pending"></div>';
    await expect(waitForPdfDiagrams(root, 20)).rejects.toThrow(/timed out/i);
  });
  it("waits for Mermaid and preserves Excalidraw SVG while removing controls", async () => {
    const html = await createPdfHtml({ content: "```mermaid\ngraph LR; A-->B\n```\n\n![Sketch](diagram.excalidraw)", currentFile: "C:/notes/document.md", title: "Diagrams", language: "en" });
    expect(html).toContain("Diagram ready");
    expect(html).toContain("Sketch ready");
    expect(html).not.toContain('<p><figure class="excalidraw-card">');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Rendering Mermaid");
    expect(html).not.toContain("C:/notes/diagram.excalidraw");
  });
  it("inlines document-relative images", async () => {
    const html = await createPdfHtml({ content: "![Photo](photo.png)", currentFile: "C:/notes/document.md", title: "Photo", language: "en" });
    expect(html).toContain('src="data:image/png;base64,aGVsbG8="');
    expect(html).not.toContain("photo.png");
  });
  it("rejects corrupt raster images inside exported SVG diagrams", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = '<image href="data:image/png;base64,broken" />';
    vi.mocked(exportToSvg).mockResolvedValueOnce(svg);
    Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: vi.fn().mockRejectedValue(new Error("corrupt image")) });
    try {
      await expect(createPdfHtml({ content: "![Sketch](diagram.excalidraw)", currentFile: "C:/notes/document.md", title: "Diagram", language: "en" })).rejects.toThrow("corrupt image");
    } finally {
      delete (HTMLImageElement.prototype as unknown as { decode?: unknown }).decode;
    }
  });
});
