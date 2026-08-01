import { useEffect, useId, useMemo, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import {
  buildMermaidExportFileName,
  buildMermaidRenderConfig,
  prepareSvgExport,
  renderSvgToPng,
} from "../mermaidExport";
import { writeBinaryFile, writeTextFile } from "../tauri";

type MermaidBlockProps = {
  source: string;
  themeMode: "system" | "light" | "dark";
};

function getEffectivePreviewTheme(themeMode: MermaidBlockProps["themeMode"]) {
  if (themeMode !== "system") {
    return themeMode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function MermaidBlock({ source, themeMode }: MermaidBlockProps) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const [effectiveTheme, setEffectiveTheme] = useState(() => getEffectivePreviewTheme(themeMode));
  const mermaidTheme = useMemo(
    () =>
      effectiveTheme === "dark"
        ? {
            background: "#18202b",
            primaryColor: "#243448",
            primaryTextColor: "#f4f8fc",
            primaryBorderColor: "#6ea8ff",
            lineColor: "#8fb8e8",
            secondaryColor: "#263c33",
            tertiaryColor: "#2d263d",
            clusterBkg: "#202a36",
            clusterBorder: "#536071",
            edgeLabelBackground: "#18202b",
            fontFamily: "Inter, Segoe UI, sans-serif",
          }
        : {
            background: "#f8fbff",
            primaryColor: "#e8f2ff",
            primaryTextColor: "#132134",
            primaryBorderColor: "#2f6fb2",
            lineColor: "#426381",
            secondaryColor: "#e8f7ef",
            tertiaryColor: "#f3ecff",
            clusterBkg: "#f1f6fb",
            clusterBorder: "#c3d0de",
            edgeLabelBackground: "#f8fbff",
            fontFamily: "Inter, Segoe UI, sans-serif",
          },
    [effectiveTheme],
  );

  useEffect(() => {
    setEffectiveTheme(getEffectivePreviewTheme(themeMode));

    if (themeMode !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setEffectiveTheme(getEffectivePreviewTheme(themeMode));
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        setError("");
        setSvg("");
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize(buildMermaidRenderConfig(mermaidTheme));
        const result = await mermaid.render(`mermaid-${id}`, source);
        if (!cancelled) {
          setSvg(result.svg);
        }
      } catch (renderError) {
        if (!cancelled) {
          setSvg("");
          setError(renderError instanceof Error ? renderError.message : String(renderError));
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [id, mermaidTheme, source]);

  const createPng = async () => {
    const svgElement = previewRef.current?.querySelector("svg");
    if (!svg || !svgElement) throw new Error("The Mermaid diagram is not ready.");
    return renderSvgToPng(svg, svgElement, effectiveTheme === "dark" ? "#18202b" : "#f8fbff");
  };

  const exportDiagram = async (format: "png" | "svg") => {
    if (!svg) return;
    setExportError("");
    try {
      const path = await save({
        defaultPath: buildMermaidExportFileName(new Date(), format),
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (!path) return;
      if (format === "svg") {
        await writeTextFile(path, prepareSvgExport(svg));
      } else {
        const blob = await createPng();
        await writeBinaryFile(path, Array.from(new Uint8Array(await blob.arrayBuffer())));
      }
    } catch (exportFailure) {
      setExportError(exportFailure instanceof Error ? exportFailure.message : String(exportFailure));
    }
  };

  const copyImage = async () => {
    setExportError("");
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Image clipboard is unavailable. Use PNG or SVG export instead.");
      }
      const blob = await createPng();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch (copyFailure) {
      setExportError(copyFailure instanceof Error ? copyFailure.message : String(copyFailure));
    }
  };

  if (error) {
    return (
      <div className="diagram-error">
        <strong>Mermaid render error</strong>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div className="mermaid-card">
      <div className="mermaid-export-toolbar" role="toolbar" aria-label="Mermaid export">
        <button type="button" disabled={!svg} onClick={() => void exportDiagram("png")}>PNG</button>
        <button type="button" disabled={!svg} onClick={() => void exportDiagram("svg")}>SVG</button>
        <button type="button" disabled={!svg} onClick={() => void copyImage()}>Copy Image</button>
      </div>
      <div
        ref={previewRef}
        className="mermaid-preview"
        dangerouslySetInnerHTML={{ __html: svg || "<span>Rendering Mermaid...</span>" }}
      />
      {exportError && <p className="mermaid-export-error" role="alert">{exportError}</p>}
    </div>
  );
}
