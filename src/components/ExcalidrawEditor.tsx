import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawScene } from "../types";
import { writeExcalidrawFile } from "../tauri";

type ExcalidrawEditorProps = {
  path: string;
  initialScene: ExcalidrawScene | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

const EMPTY_SCENE: ExcalidrawScene = {
  type: "excalidraw",
  version: 2,
  source: "rust-text-editor",
  elements: [],
  appState: {
    viewBackgroundColor: "#ffffff",
  },
  files: {},
};

export function ExcalidrawEditor({
  path,
  initialScene,
  onClose,
  onSaved,
  onError,
}: ExcalidrawEditorProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [dirty, setDirty] = useState(false);

  const scene = useMemo(() => initialScene ?? EMPTY_SCENE, [initialScene]);

  useEffect(() => {
    setDirty(false);
  }, [path]);

  const handleSave = useCallback(async () => {
    const api = apiRef.current;

    if (!api) {
      onError("Excalidraw is still loading. Try again in a moment.");
      return;
    }

    const data: ExcalidrawScene = {
      type: "excalidraw",
      version: 2,
      source: "rust-text-editor",
      elements: api.getSceneElementsIncludingDeleted(),
      appState: {
        ...api.getAppState(),
        collaborators: undefined,
      },
      files: api.getFiles(),
    };

    try {
      await writeExcalidrawFile(path, JSON.stringify(data, null, 2));
      setDirty(false);
      onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }, [onError, onSaved, path]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="excalidraw-modal">
        <header className="modal-toolbar">
          <div>
            <strong>Excalidraw</strong>
            <span>{path}</span>
          </div>
          <div className="modal-actions">
            <button onClick={handleSave}>Save Diagram</button>
            <button onClick={onClose}>{dirty ? "Close Without Saving" : "Close"}</button>
          </div>
        </header>
        <div className="excalidraw-host">
          <Excalidraw
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            initialData={{
              elements: scene.elements as never,
              appState: scene.appState as never,
              files: scene.files as never,
            }}
            onChange={() => setDirty(true)}
          />
        </div>
      </section>
    </div>
  );
}
