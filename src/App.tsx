import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { exitApp, readTextFile, writeTextFile } from "./tauri";
import type { EditorError, ExcalidrawScene } from "./types";
import { saveCurrentWindowState } from "./windowState";

const ExcalidrawEditor = lazy(() =>
  import("./components/ExcalidrawEditor").then((module) => ({
    default: module.ExcalidrawEditor,
  })),
);

type ExcalidrawSession = {
  path: string;
  scene: ExcalidrawScene | null;
};

type ThemeMode = "system" | "light" | "dark";

const EMPTY_DOCUMENT = "";
const THEME_STORAGE_KEY = "rust-text-editor-theme";
const SPLIT_STORAGE_KEY = "rust-text-editor-split";
const PREVIEW_STORAGE_KEY = "rust-text-editor-preview-visible";

export default function App() {
  const [content, setContent] = useState(EMPTY_DOCUMENT);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [modified, setModified] = useState(false);
  const [error, setError] = useState<EditorError | null>(null);
  const [excalidrawSession, setExcalidrawSession] = useState<ExcalidrawSession | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(() => {
    return window.localStorage.getItem(PREVIEW_STORAGE_KEY) === "true";
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= 25 && saved <= 75 ? saved : 50;
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const stats = useMemo(
    () => ({
      lines: content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length,
      chars: content.length,
    }),
    [content],
  );

  const showError = useCallback((title: string, message: string) => {
    setError({ title, message });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(splitPercent));
  }, [splitPercent]);

  useEffect(() => {
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, String(isPreviewVisible));
  }, [isPreviewVisible]);

  const handleNew = useCallback(() => {
    setContent(EMPTY_DOCUMENT);
    setCurrentFile(null);
    setModified(false);
    setError(null);
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "JSON", extensions: ["json"] },
          { name: "Markdown and Text", extensions: ["md", "markdown", "txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (typeof selected !== "string") {
        return;
      }

      const file = await readTextFile(selected);
      setContent(file.content);
      setCurrentFile(file.path);
      setModified(false);
      setError(null);
    } catch (openError) {
      showError("Open failed", openError instanceof Error ? openError.message : String(openError));
    }
  }, [showError]);

  const handleSaveAs = useCallback(async () => {
    try {
      const selected = await save({
        filters: [
          { name: "JSON", extensions: ["json"] },
          { name: "Markdown", extensions: ["md"] },
          { name: "Text", extensions: ["txt"] },
        ],
      });

      if (!selected) {
        return;
      }

      await writeTextFile(selected, content);
      setCurrentFile(selected);
      setModified(false);
      setError(null);
    } catch (saveError) {
      showError("Save failed", saveError instanceof Error ? saveError.message : String(saveError));
    }
  }, [content, showError]);

  const handleSave = useCallback(async () => {
    if (!currentFile) {
      await handleSaveAs();
      return;
    }

    try {
      await writeTextFile(currentFile, content);
      setModified(false);
      setError(null);
    } catch (saveError) {
      showError("Save failed", saveError instanceof Error ? saveError.message : String(saveError));
    }
  }, [content, currentFile, handleSaveAs, showError]);

  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    setModified(true);
  }, []);

  const handleFormatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(content);
      setContent(`${JSON.stringify(parsed, null, 2)}\n`);
      setModified(true);
      setError(null);
    } catch (formatError) {
      showError(
        "JSON format failed",
        formatError instanceof Error ? formatError.message : String(formatError),
      );
    }
  }, [content, showError]);

  const handleExcalidrawSaved = useCallback(() => {
    setPreviewRevision((revision) => revision + 1);
  }, []);

  const handleExit = useCallback(async () => {
    try {
      await saveCurrentWindowState();
      await exitApp();
    } catch (closeError) {
      showError("Exit failed", closeError instanceof Error ? closeError.message : String(closeError));
    }
  }, [showError]);

  const updateSplitFromPointer = useCallback((clientX: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    const next = ((clientX - bounds.left) / bounds.width) * 100;
    setSplitPercent(Math.min(75, Math.max(25, next)));
  }, []);

  useEffect(() => {
    if (!isDraggingSplit) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      updateSplitFromPointer(event.clientX);
    }

    function handlePointerUp() {
      setIsDraggingSplit(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    document.body.classList.add("resizing-pane");

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("resizing-pane");
    };
  }, [isDraggingSplit, updateSplitFromPointer]);

  return (
    <main className="app-shell" data-theme={themeMode}>
      <header className="menubar-shell">
        <nav className="menubar" aria-label="Application menu">
          <div className="menu-root">
            <button className="menu-title">File</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={handleNew}>New</button>
              <button role="menuitem" onClick={handleOpen}>Open...</button>
              <button role="menuitem" onClick={handleSave}>Save</button>
              <button role="menuitem" onClick={handleSaveAs}>Save As...</button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={handleExit}>Exit</button>
            </div>
          </div>

          <div className="menu-root">
            <button className="menu-title">View</button>
            <div className="menu-popover" role="menu">
              <button role="menuitemradio" aria-checked={themeMode === "system"} onClick={() => setThemeMode("system")}>
                {themeMode === "system" ? "[x] " : ""}System Theme
              </button>
              <button role="menuitemradio" aria-checked={themeMode === "light"} onClick={() => setThemeMode("light")}>
                {themeMode === "light" ? "[x] " : ""}Light Theme
              </button>
              <button role="menuitemradio" aria-checked={themeMode === "dark"} onClick={() => setThemeMode("dark")}>
                {themeMode === "dark" ? "[x] " : ""}Dark Theme
              </button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={() => setSplitPercent(50)}>Reset Split</button>
            </div>
          </div>

          <div className="menu-root">
            <button className="menu-title">Preview</button>
            <div className="menu-popover" role="menu">
              <button
                role="menuitemcheckbox"
                aria-checked={isPreviewVisible}
                onClick={() => setIsPreviewVisible((visible) => !visible)}
              >
                {isPreviewVisible ? "[x] " : ""}Show Preview
              </button>
            </div>
          </div>

          <div className="menu-root">
            <button className="menu-title">Format</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={handleFormatJson}>Format JSON</button>
            </div>
          </div>
        </nav>

        <div className="window-caption">
          <strong>Hotaru</strong>
          <span>Markdown, Mermaid, and Excalidraw</span>
        </div>
      </header>

      {error && (
        <section className="error-banner" role="alert">
          <div>
            <strong>{error.title}</strong>
            <span>{error.message}</span>
          </div>
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            Dismiss
          </button>
        </section>
      )}

      <section
        className="workspace"
        ref={workspaceRef}
        style={{
          gridTemplateColumns: isPreviewVisible
            ? `minmax(240px, calc(${splitPercent}% - 3px)) 6px minmax(240px, calc(${100 - splitPercent}% - 3px))`
            : "minmax(240px, 1fr)",
        }}
      >
        <article className="editor-pane">
          <header className="pane-header">
            <span>Editor</span>
            <small>{currentFile ?? "Untitled"}</small>
          </header>
          <textarea
            value={content}
            onChange={(event) => handleContentChange(event.target.value)}
            spellCheck={false}
            aria-label="Markdown editor"
            placeholder="Write Markdown here. Use fenced ```mermaid blocks and image links to .excalidraw files."
          />
        </article>

        {isPreviewVisible && (
          <>
            <div
              className="splitter"
              role="separator"
              aria-label="Resize editor and preview panes"
              aria-orientation="vertical"
              aria-valuemin={25}
              aria-valuemax={75}
              aria-valuenow={Math.round(splitPercent)}
              tabIndex={0}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setIsDraggingSplit(true);
                updateSplitFromPointer(event.clientX);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  setSplitPercent((value) => Math.max(25, value - 2));
                } else if (event.key === "ArrowRight") {
                  setSplitPercent((value) => Math.min(75, value + 2));
                }
              }}
            />

            <article className="preview-pane">
              <header className="pane-header">
                <span>Preview</span>
                <small>Markdown, Mermaid, Excalidraw</small>
              </header>
              <MarkdownPreview
                key={previewRevision}
                ref={previewRef}
                markdown={content}
                currentFile={currentFile}
                onOpenExcalidraw={(path, scene) => setExcalidrawSession({ path, scene })}
              />
            </article>
          </>
        )}
      </section>

      <footer className="statusbar">
        <span>{currentFile ? `File: ${currentFile}` : "File: Untitled"}</span>
        <span>{modified ? "Modified" : "Saved"}</span>
        <span>Lines: {stats.lines}</span>
        <span>Chars: {stats.chars}</span>
      </footer>

      {excalidrawSession && (
        <Suspense fallback={<div className="modal-backdrop">Loading Excalidraw...</div>}>
          <ExcalidrawEditor
            path={excalidrawSession.path}
            initialScene={excalidrawSession.scene}
            onClose={() => setExcalidrawSession(null)}
            onSaved={handleExcalidrawSaved}
            onError={(message) => showError("Excalidraw save failed", message)}
          />
        </Suspense>
      )}
    </main>
  );
}
