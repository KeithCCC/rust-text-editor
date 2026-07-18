import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawScene } from "../types";
import { ExcalidrawContentBaseline } from "../excalidrawDirty";
import { MODAL_LAYERS } from "../modalLayers";
import { writeExcalidrawFile } from "../tauri";

type ExcalidrawEditorProps = {
  path: string;
  initialScene: ExcalidrawScene | null;
  onClose: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onError: (message: string) => void;
};

export type ExcalidrawEditorHandle = {
  save: () => Promise<boolean>;
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

export const ExcalidrawEditor = forwardRef<ExcalidrawEditorHandle, ExcalidrawEditorProps>(function ExcalidrawEditor({
  path,
  initialScene,
  onClose,
  onSaved,
  onDirtyChange,
  onError,
}, ref) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [dirty, setDirty] = useState(false);

  const scene = useMemo(() => initialScene ?? EMPTY_SCENE, [initialScene]);
  const contentBaselineRef = useRef(new ExcalidrawContentBaseline(scene.elements, scene.files));

  useEffect(() => {
    contentBaselineRef.current.reset(scene.elements, scene.files);
    setDirty(false);
    onDirtyChange(false);
  }, [onDirtyChange, path, scene.elements, scene.files]);

  const handleSave = useCallback(async () => {
    const api = apiRef.current;

    if (!api) {
      onError("Excalidraw is still loading. Try again in a moment.");
      return false;
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
      contentBaselineRef.current.reset(data.elements, data.files);
      setDirty(false);
      onDirtyChange(false);
      onSaved();
      return true;
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }, [onDirtyChange, onError, onSaved, path]);

  useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave]);

  const updateDirtyState = useCallback((elements: unknown, files: unknown) => {
    const nextDirty = contentBaselineRef.current.isDirty(elements, files);
    setDirty(nextDirty);
    onDirtyChange(nextDirty);
  }, [onDirtyChange]);

  return (
    <div
      className="modal-backdrop excalidraw-backdrop"
      style={{ zIndex: MODAL_LAYERS.excalidraw }}
      role="dialog"
      aria-modal="true"
    >
      <section className="excalidraw-modal">
        <header className="modal-toolbar">
          <div>
            <strong>Excalidraw</strong>
            <span>{path}</span>
          </div>
          <div className="modal-actions">
            <button onClick={() => void handleSave()}>Save Diagram</button>
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
            onChange={(elements, _appState, files) => updateDirtyState(elements, files)}
          />
        </div>
      </section>
    </div>
  );
});
