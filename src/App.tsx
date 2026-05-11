import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { MarkdownPreview } from "./components/MarkdownPreview";
import {
  createVaultNote,
  ensureDefaultHotaruVault,
  ensureHotaruVault,
  exitApp,
  readTextFile,
  writeTextFile,
} from "./tauri";
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
const THEME_STORAGE_KEY = "hotaru-theme";
const LEGACY_THEME_STORAGE_KEY = "rust-text-editor-theme";
const SPLIT_STORAGE_KEY = "hotaru-split";
const LEGACY_SPLIT_STORAGE_KEY = "rust-text-editor-split";
const PREVIEW_STORAGE_KEY = "hotaru-preview-visible";
const LEGACY_PREVIEW_STORAGE_KEY = "rust-text-editor-preview-visible";
const VAULT_STORAGE_KEY = "hotaru-vault-path";
const LAST_FILE_STORAGE_KEY = "hotaru-last-file";

let startupVaultInitializationStarted = false;

function readStoredValue(key: string, legacyKey?: string) {
  return window.localStorage.getItem(key) ?? (legacyKey ? window.localStorage.getItem(legacyKey) : null);
}

function isInsideVault(filePath: string | null, vaultPath: string | null) {
  if (!filePath || !vaultPath) {
    return false;
  }

  const normalizedFile = filePath.replace(/\\/g, "/").toLowerCase();
  const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

  return normalizedFile === normalizedVault || normalizedFile.startsWith(`${normalizedVault}/`);
}

export default function App() {
  const [content, setContent] = useState(EMPTY_DOCUMENT);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [isVaultInitializing, setIsVaultInitializing] = useState(true);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [modified, setModified] = useState(false);
  const [error, setError] = useState<EditorError | null>(null);
  const [excalidrawSession, setExcalidrawSession] = useState<ExcalidrawSession | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(() => {
    return readStoredValue(PREVIEW_STORAGE_KEY, LEGACY_PREVIEW_STORAGE_KEY) === "true";
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = readStoredValue(THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = Number(readStoredValue(SPLIT_STORAGE_KEY, LEGACY_SPLIT_STORAGE_KEY));
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

  const openFilePath = useCallback(async (path: string) => {
    const file = await readTextFile(path);
    setContent(file.content);
    setCurrentFile(file.path);
    window.localStorage.setItem(LAST_FILE_STORAGE_KEY, file.path);
    setModified(false);
    setError(null);
  }, []);

  const openVaultFolderPicker = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: true,
      title: "Choose where Hotaru should create or use hotaru-valut",
    });

    if (typeof selected !== "string") {
      return null;
    }

    const preparedVault = await ensureHotaruVault(selected);
    window.localStorage.setItem(VAULT_STORAGE_KEY, preparedVault);
    setVaultPath(preparedVault);
    return preparedVault;
  }, []);

  const createAndOpenVaultNote = useCallback(async (preparedVault: string, initialContent = EMPTY_DOCUMENT) => {
    const file = await createVaultNote(preparedVault, initialContent);
    setContent(file.content);
    setCurrentFile(file.path);
    window.localStorage.setItem(LAST_FILE_STORAGE_KEY, file.path);
    setModified(false);
    setError(null);
    return file.path;
  }, []);

  const ensureVaultReady = useCallback(async () => {
    const existingVault = vaultPath ?? window.localStorage.getItem(VAULT_STORAGE_KEY);
    if (existingVault) {
      setVaultPath(existingVault);
      return existingVault;
    }

    const defaultVault = await ensureDefaultHotaruVault();
    window.localStorage.setItem(VAULT_STORAGE_KEY, defaultVault);
    setVaultPath(defaultVault);
    return defaultVault;
  }, [vaultPath]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(splitPercent));
  }, [splitPercent]);

  useEffect(() => {
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, String(isPreviewVisible));
  }, [isPreviewVisible]);

  useEffect(() => {
    if (startupVaultInitializationStarted) {
      return;
    }
    startupVaultInitializationStarted = true;

    async function initializeVaultAndDocument() {
      try {
        const storedVault = window.localStorage.getItem(VAULT_STORAGE_KEY);
        let preparedVault = storedVault;

        if (!preparedVault) {
          preparedVault = await ensureDefaultHotaruVault();
        }

        setVaultPath(preparedVault);
        window.localStorage.setItem(VAULT_STORAGE_KEY, preparedVault);

        const lastFile = window.localStorage.getItem(LAST_FILE_STORAGE_KEY);
        if (lastFile) {
          try {
            const file = await readTextFile(lastFile);
            setContent(file.content);
            setCurrentFile(file.path);
            setModified(false);
            setError(null);
            return;
          } catch (restoreError) {
            showError(
              "Restore failed",
              restoreError instanceof Error ? restoreError.message : String(restoreError),
            );
          }
        }

        await createAndOpenVaultNote(preparedVault);
      } catch (startupError) {
        showError("Startup failed", startupError instanceof Error ? startupError.message : String(startupError));
      } finally {
        setIsVaultInitializing(false);
      }
    }

    void initializeVaultAndDocument();
  }, [createAndOpenVaultNote, showError]);

  useEffect(() => {
    if (currentFile) {
      window.localStorage.setItem(LAST_FILE_STORAGE_KEY, currentFile);
    }
  }, [currentFile]);

  useEffect(() => {
    if (!currentFile || !isInsideVault(currentFile, vaultPath) || isVaultInitializing) {
      return;
    }

    const vaultFile = currentFile;
    const saveTimer = window.setTimeout(() => {
      void writeTextFile(vaultFile, content)
        .then(() => setModified(false))
        .catch((autosaveError: unknown) => {
          showError(
            "Vault autosave failed",
            autosaveError instanceof Error ? autosaveError.message : String(autosaveError),
          );
        });
    }, 500);

    return () => window.clearTimeout(saveTimer);
  }, [content, currentFile, isVaultInitializing, showError, vaultPath]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    async function listenForFileDrops() {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        const dragEvent = event.payload;

        if (dragEvent.type === "enter" || dragEvent.type === "over") {
          setIsFileDragOver(true);
          return;
        }

        setIsFileDragOver(false);

        if (dragEvent.type !== "drop") {
          return;
        }

        const [path] = dragEvent.paths;
        if (!path) {
          return;
        }

        if (dragEvent.paths.length > 1) {
          showError("Drop failed", "Drop one file at a time.");
          return;
        }

        void openFilePath(path).catch((dropError: unknown) => {
          showError("Drop failed", dropError instanceof Error ? dropError.message : String(dropError));
        });
      });

      if (cancelled && unlisten) {
        unlisten();
      }
    }

    void listenForFileDrops().catch((dropSetupError: unknown) => {
      showError("Drop setup failed", dropSetupError instanceof Error ? dropSetupError.message : String(dropSetupError));
    });

    return () => {
      cancelled = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [openFilePath, showError]);

  const handleNew = useCallback(async () => {
    try {
      const preparedVault = await ensureVaultReady();
      if (!preparedVault) {
        return;
      }

      await createAndOpenVaultNote(preparedVault);
    } catch (newError) {
      showError("New note failed", newError instanceof Error ? newError.message : String(newError));
    }
  }, [createAndOpenVaultNote, ensureVaultReady, showError]);

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

      await openFilePath(selected);
    } catch (openError) {
      showError("Open failed", openError instanceof Error ? openError.message : String(openError));
    }
  }, [openFilePath, showError]);

  const handleSetVault = useCallback(async () => {
    try {
      const preparedVault = await openVaultFolderPicker();
      if (!preparedVault) {
        return;
      }

      await createAndOpenVaultNote(preparedVault);
    } catch (vaultError) {
      showError("Vault setup failed", vaultError instanceof Error ? vaultError.message : String(vaultError));
    }
  }, [createAndOpenVaultNote, openVaultFolderPicker, showError]);

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
      window.localStorage.setItem(LAST_FILE_STORAGE_KEY, selected);
      setModified(false);
      setError(null);
    } catch (saveError) {
      showError("Save failed", saveError instanceof Error ? saveError.message : String(saveError));
    }
  }, [content, showError]);

  const handleSave = useCallback(async () => {
    if (!currentFile) {
      try {
        const preparedVault = await ensureVaultReady();
        if (!preparedVault) {
          return;
        }

        const file = await createVaultNote(preparedVault, content);
        setCurrentFile(file.path);
        window.localStorage.setItem(LAST_FILE_STORAGE_KEY, file.path);
        setModified(false);
        setError(null);
      } catch (saveError) {
        showError("Save failed", saveError instanceof Error ? saveError.message : String(saveError));
      }
      return;
    }

    try {
      await writeTextFile(currentFile, content);
      setModified(false);
      setError(null);
    } catch (saveError) {
      showError("Save failed", saveError instanceof Error ? saveError.message : String(saveError));
    }
  }, [content, createVaultNote, currentFile, ensureVaultReady, showError]);

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
    <main className="app-shell" data-theme={themeMode} data-file-drag-over={isFileDragOver}>
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
              <button role="menuitem" onClick={handleSetVault}>Set Vault...</button>
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

      {isFileDragOver && (
        <section className="drop-overlay" aria-live="polite">
          <strong>Drop to open</strong>
          <span>Release one text, Markdown, JSON, or Excalidraw file here.</span>
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
        <span>{vaultPath ? `Vault: ${vaultPath}` : "Vault: Not set"}</span>
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
