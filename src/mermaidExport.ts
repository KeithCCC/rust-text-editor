function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function buildMermaidExportFileName(date: Date, extension: "png" | "svg") {
  return `mermaid-diagram-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.${extension}`;
}

export function prepareSvgExport(svg: string) {
  return /<svg\b[^>]*\bxmlns=/.test(svg)
    ? svg
    : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
}

export async function renderSvgToPng(svg: string, svgElement: SVGSVGElement, background: string) {
  const bounds = svgElement.getBoundingClientRect();
  const viewBox = svgElement.viewBox.baseVal;
  const width = Math.max(1, Math.ceil(bounds.width || viewBox.width || 800));
  const height = Math.max(1, Math.ceil(bounds.height || viewBox.height || 600));
  const scale = 2;
  const source = new Blob([prepareSvgExport(svg)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable.");
    context.scale(scale, scale);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG conversion failed.")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
