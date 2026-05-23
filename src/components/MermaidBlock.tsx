import { useEffect, useId, useMemo, useState } from "react";

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
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: mermaidTheme,
        });
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

  if (error) {
    return (
      <div className="diagram-error">
        <strong>Mermaid render error</strong>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div
      className="mermaid-preview"
      dangerouslySetInnerHTML={{ __html: svg || "<span>Rendering Mermaid...</span>" }}
    />
  );
}
