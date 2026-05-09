import { useEffect, useState } from "react";
import type { ExcalidrawScene } from "../types";
import { readExcalidrawFile, resolveRelativePath } from "../tauri";

type ExcalidrawEmbedProps = {
  alt: string;
  src: string;
  currentFile: string | null;
  onOpen: (path: string, scene: ExcalidrawScene | null) => void;
};

type EmbedState =
  | { status: "idle" | "loading"; path?: string }
  | { status: "ready"; path: string; svg: string; scene: ExcalidrawScene }
  | { status: "missing"; path: string; message: string };

export function ExcalidrawEmbed({ alt, src, currentFile, onOpen }: ExcalidrawEmbedProps) {
  const [state, setState] = useState<EmbedState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function loadScene() {
      if (!currentFile) {
        setState({
          status: "missing",
          path: src,
          message: "Save this Markdown file before resolving relative Excalidraw links.",
        });
        return;
      }

      setState({ status: "loading" });
      let path = src;

      try {
        path = await resolveRelativePath(currentFile, src);
        const raw = await readExcalidrawFile(path);
        const scene = JSON.parse(raw) as ExcalidrawScene;
        const svg = await exportScene(scene);

        if (!cancelled) {
          setState({ status: "ready", path, svg, scene });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "missing",
            path,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    loadScene();

    return () => {
      cancelled = true;
    };
  }, [currentFile, src]);

  if (state.status === "loading" || state.status === "idle") {
    return <div className="excalidraw-card">Loading Excalidraw preview...</div>;
  }

  if (state.status === "missing") {
    return (
      <button className="excalidraw-card missing" onClick={() => onOpen(state.path, null)}>
        <span>{alt || "Excalidraw diagram"}</span>
        <small>{state.message}</small>
      </button>
    );
  }

  if (state.status === "ready") {
    return (
      <button className="excalidraw-card" onClick={() => onOpen(state.path, state.scene)}>
        <span>{alt || "Excalidraw diagram"}</span>
        <div className="excalidraw-svg" dangerouslySetInnerHTML={{ __html: state.svg }} />
        <small>{state.path}</small>
      </button>
    );
  }

  return null;
}

async function exportScene(scene: ExcalidrawScene) {
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  const svg = await exportToSvg({
    elements: (scene.elements ?? []) as never,
    appState: {
      ...(scene.appState ?? {}),
      exportBackground: true,
      viewBackgroundColor:
        typeof scene.appState?.viewBackgroundColor === "string"
          ? scene.appState.viewBackgroundColor
          : "#ffffff",
    } as never,
    files: (scene.files ?? {}) as never,
    exportPadding: 16,
    skipInliningFonts: true,
  });

  return svg.outerHTML;
}
