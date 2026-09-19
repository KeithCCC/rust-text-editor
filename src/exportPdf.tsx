import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { MarkdownPreview } from "./components/MarkdownPreview";

type PdfOptions = { content: string; currentFile: string | null; title: string; language: string };
const ASSET_TIMEOUT = 30_000;

async function withTimeout<T>(promise: Promise<T>, message: string, timeout = ASSET_TIMEOUT): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeout); })]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function waitForPdfDiagrams(root: HTMLElement, timeout = ASSET_TIMEOUT) {
  const started = Date.now();
  for (;;) {
    const error = root.querySelector('[data-pdf-status="error"]');
    if (error) throw new Error(`PDF diagram failed: ${error.textContent}`);
    if (!root.querySelector('[data-pdf-status="pending"]')) return;
    if (Date.now() - started >= timeout) throw new Error("PDF diagram rendering timed out.");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const PRINT_CSS = `
@page { size: A4; margin: 16mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #18202b; }
body { font-family: "Segoe UI", "Yu Gothic", "Meiryo", sans-serif; font-size: 10.5pt; line-height: 1.65; overflow-wrap: anywhere; }
h1,h2,h3,h4,h5,h6 { line-height: 1.3; break-after: avoid; margin: 1.2em 0 .5em; }
h1 { font-size: 24pt; } h2 { font-size: 18pt; } h3 { font-size: 14pt; }
p,ul,ol,pre,table,blockquote { margin: .7em 0; }
p { orphans: 3; widows: 3; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f4f5f7; padding: 10px; border-radius: 4px; }
code { font-family: Consolas, "Yu Gothic", monospace; font-size: .9em; }
blockquote { border-left: 3px solid #b6c3d1; padding-left: 12px; color: #475569; }
table { border-collapse: collapse; width: 100%; table-layout: auto; }
th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
th { background: #f1f5f9; } thead { display: table-header-group; } tr { break-inside: avoid; }
img, svg { max-width: 100%; height: auto; } img { display: inline-block; }
a { color: #1d4ed8; text-decoration: underline; }
.mermaid-card,.excalidraw-card { break-inside: avoid; margin: 12px 0; }
.mermaid-preview { text-align: center; } .excalidraw-svg svg { display: block; }
.json-token-key { color: #7c3aed; } .json-token-string { color: #166534; }
.json-token-number,.json-token-boolean,.json-token-null { color: #1d4ed8; }
input[type=checkbox] { accent-color: #334155; }
`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

async function imageDataUri(src: string, currentFile: string | null): Promise<string> {
  if (/^data:image\/(png|jpeg|gif|webp|svg\+xml);/i.test(src)) return src;
  if (/^https?:\/\//i.test(src)) {
    // Native loading supports ordinary image servers without CORS headers.
    // Keep percent encoding in URLs; only filesystem paths are decoded below.
    return invoke<string>("read_pdf_image", { currentFile, src });
  }
  if (!src || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) throw new Error("Unsupported image URL");
  if (!currentFile) throw new Error("Save the document before exporting relative images.");
  return invoke<string>("read_pdf_image", { currentFile, src: decodeURIComponent(src) });
}

async function inlineImages(root: HTMLElement, currentFile: string | null) {
  await Promise.all(Array.from(root.querySelectorAll("img, svg image")).map(async (element) => {
    const source = element.getAttribute("data-pdf-src") ?? element.getAttribute("src") ?? element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? "";
    try {
      const data = await withTimeout(imageDataUri(source, currentFile), "Image loading timed out.");
      if (element instanceof HTMLImageElement) {
        element.src = data;
        if (typeof element.decode === "function") await withTimeout(element.decode(), "Image decoding timed out.");
      } else {
        // SVGImageElement has no decode(); validate its payload with an image
        // probe so embedded Excalidraw rasters cannot silently disappear.
        const probe = new Image();
        probe.src = data;
        if (typeof probe.decode === "function") await withTimeout(probe.decode(), "SVG image decoding timed out.");
        element.setAttribute("href", data);
        element.removeAttribute("xlink:href");
      }
      element.removeAttribute("data-pdf-src");
    } catch (error) {
      throw new Error(`PDF image failed (${source.slice(0, 160)}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
}

function cleanSnapshot(root: HTMLElement) {
  // Excalidraw's preview itself is a button; retain its SVG and accessible label.
  root.querySelectorAll("button.excalidraw-card").forEach((button) => {
    const figure = document.createElement("figure");
    figure.className = "excalidraw-card";
    for (const child of Array.from(button.children)) if (child.tagName !== "SMALL") figure.append(child);
    button.replaceWith(figure);
  });
  root.querySelectorAll("script,iframe,object,embed,link,meta,base,form,button,.mermaid-export-toolbar,.mermaid-export-error").forEach((element) => element.remove());
  root.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || attribute.name === "srcdoc" || attribute.name.startsWith("data-pdf-")) element.removeAttribute(attribute.name);
      if (["href", "xlink:href"].includes(attribute.name) && !/^(?:#|https?:\/\/|mailto:|data:image\/)/i.test(attribute.value)) element.removeAttribute(attribute.name);
    }
  });
}

export async function createPdfHtml({ content, currentFile, title, language }: PdfOptions): Promise<string> {
  const stage = document.createElement("div");
  stage.dataset.pdfStage = "true";
  stage.className = "app-shell";
  stage.dataset.theme = "light";
  stage.setAttribute("aria-hidden", "true");
  stage.style.cssText = "position:fixed;left:-20000px;top:0;width:720px;display:block;height:auto;pointer-events:none;background:white;color:black";
  document.body.append(stage);
  const root = createRoot(stage);
  try {
    flushSync(() => root.render(<MarkdownPreview markdown={content} currentFile={currentFile} themeMode="light" printMode onOpenExcalidraw={() => {}} onOpenExternalLink={() => {}} onOpenRelativeMarkdownLink={() => {}} />));
    await waitForPdfDiagrams(stage);
    await inlineImages(stage, currentFile);
    if (document.fonts) await withTimeout(document.fonts.ready, "PDF font loading timed out.");
    const snapshot = stage.querySelector(".preview-body")!.cloneNode(true) as HTMLElement;
    cleanSnapshot(snapshot);
    return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${snapshot.innerHTML}</body></html>`;
  } finally {
    root.unmount();
    stage.remove();
  }
}
