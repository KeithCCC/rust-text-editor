import { useEffect, useId, useState } from "react";

type MermaidBlockProps = {
  source: string;
};

export function MermaidBlock({ source }: MermaidBlockProps) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        setError("");
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "default",
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
  }, [id, source]);

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
