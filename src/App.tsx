import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { logDebug } from "./debugLog";
import {
  createVaultNote,
  ensureDefaultHotaruVault,
  ensureHotaruVault,
  exitApp,
  getFileProperties,
  getStartupFilePath,
  listVaultFiles,
  openFileInNewInstance,
  readTextFile,
  writeTextFile,
} from "./tauri";
import type { FileProperties, VaultFile } from "./tauri";
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
type MenuId = "file" | "view" | "settings" | "format";

const EMPTY_DOCUMENT = "";
const THEME_STORAGE_KEY = "hotaru-theme";
const LEGACY_THEME_STORAGE_KEY = "rust-text-editor-theme";
const SPLIT_STORAGE_KEY = "hotaru-split";
const LEGACY_SPLIT_STORAGE_KEY = "rust-text-editor-split";
const PREVIEW_STORAGE_KEY = "hotaru-preview-visible";
const LEGACY_PREVIEW_STORAGE_KEY = "rust-text-editor-preview-visible";
const VAULT_STORAGE_KEY = "hotaru-vault-path";
const LAST_FILE_STORAGE_KEY = "hotaru-last-file";
const EDITOR_FONT_SIZE_STORAGE_KEY = "hotaru-editor-font-size";
const EDITOR_LINE_HEIGHT_STORAGE_KEY = "hotaru-editor-line-height";
const PREVIEW_FONT_SIZE_STORAGE_KEY = "hotaru-preview-font-size";
const PREVIEW_LINE_HEIGHT_STORAGE_KEY = "hotaru-preview-line-height";
const UI_FONT_SIZE_STORAGE_KEY = "hotaru-ui-font-size";

let startupVaultInitializationStarted = false;

function readStoredValue(key: string, legacyKey?: string) {
  return window.localStorage.getItem(key) ?? (legacyKey ? window.localStorage.getItem(legacyKey) : null);
}

function readStoredNumber(key: string, fallback: number, min: number, max: number) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function isInsideVault(filePath: string | null, vaultPath: string | null) {
  if (!filePath || !vaultPath) {
    return false;
  }

  const normalizedFile = filePath.replace(/\\/g, "/").toLowerCase();
  const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

  return normalizedFile === normalizedVault || normalizedFile.startsWith(`${normalizedVault}/`);
}

function formatFileDate(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
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
  const [fileProperties, setFileProperties] = useState<FileProperties | null>(null);
  const [isVaultSettingsOpen, setIsVaultSettingsOpen] = useState(false);
  const [isAppearanceSettingsOpen, setIsAppearanceSettingsOpen] = useState(false);
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [isVaultFilesLoading, setIsVaultFilesLoading] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(() => {
    return readStoredValue(PREVIEW_STORAGE_KEY, LEGACY_PREVIEW_STORAGE_KEY) === "true";
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = readStoredValue(THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [editorFontSize, setEditorFontSize] = useState(() => readStoredNumber(EDITOR_FONT_SIZE_STORAGE_KEY, 14, 10, 28));
  const [editorLineHeight, setEditorLineHeight] = useState(() => readStoredNumber(EDITOR_LINE_HEIGHT_STORAGE_KEY, 1.55, 1.1, 2.4));
  const [previewFontSize, setPreviewFontSize] = useState(() => readStoredNumber(PREVIEW_FONT_SIZE_STORAGE_KEY, 16, 10, 30));
  const [previewLineHeight, setPreviewLineHeight] = useState(() => readStoredNumber(PREVIEW_LINE_HEIGHT_STORAGE_KEY, 1.65, 1.1, 2.4));
  const [uiFontSize, setUiFontSize] = useState(() => readStoredNumber(UI_FONT_SIZE_STORAGE_KEY, 13, 10, 18));
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = Number(readStoredValue(SPLIT_STORAGE_KEY, LEGACY_SPLIT_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= 25 && saved <= 75 ? saved : 50;
  });
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [hasSearchSelection, setHasSearchSelection] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const menubarRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const syncScrollFrameRef = useRef<number | null>(null);

  const stats = useMemo(
    () => ({
      lines: content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length,
      chars: content.length,
    }),
    [content],
  );
  const appStyle = useMemo(() => ({
    "--editor-font-size": `${editorFontSize}px`,
    "--editor-line-height": String(editorLineHeight),
    "--preview-font-size": `${previewFontSize}px`,
    "--preview-line-height": String(previewLineHeight),
    "--ui-font-size": `${uiFontSize}px`,
  }) as CSSProperties, [editorFontSize, editorLineHeight, previewFontSize, previewLineHeight, uiFontSize]);
  const searchMatches = useMemo(() => {
    if (!searchQuery) {
      return [];
    }

    const matches: number[] = [];
    const normalizedContent = content.toLocaleLowerCase();
    const normalizedQuery = searchQuery.toLocaleLowerCase();
    let index = normalizedContent.indexOf(normalizedQuery);

    while (index !== -1) {
      matches.push(index);
      index = normalizedContent.indexOf(normalizedQuery, index + normalizedQuery.length);
    }

    return matches;
  }, [content, searchQuery]);

  const showError = useCallback((title: string, message: string) => {
    setError({ title, message });
  }, []);

  const runMenuAction = useCallback((action: () => void | Promise<void>) => {
    setActiveMenu(null);
    void action();
  }, []);

  const scrollEditorToOffset = useCallback((offset: number) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const computedStyle = window.getComputedStyle(editor);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 22;
    const lineIndex = content.slice(0, offset).split(/\r\n|\r|\n/).length - 1;
    const targetTop = Math.max(0, lineIndex * lineHeight - editor.clientHeight / 2);
    editor.scrollTop = targetTop;
  }, [content]);

  const selectSearchMatch = useCallback((matchIndex: number) => {
    const start = searchMatches[matchIndex];
    const editor = editorRef.current;
    if (start === undefined || !editor) {
      return;
    }

    const end = start + searchQuery.length;
    editor.focus();
    editor.setSelectionRange(start, end);
    scrollEditorToOffset(start);
  }, [scrollEditorToOffset, searchMatches, searchQuery]);

  const moveSearch = useCallback((direction: 1 | -1) => {
    if (searchMatches.length === 0) {
      return;
    }

    const next = hasSearchSelection
      ? (activeSearchIndex + direction + searchMatches.length) % searchMatches.length
      : direction === 1
        ? 0
        : searchMatches.length - 1;
    setActiveSearchIndex(next);
    setHasSearchSelection(true);
    selectSearchMatch(next);
  }, [activeSearchIndex, hasSearchSelection, searchMatches.length, selectSearchMatch]);

  const syncScrollPosition = useCallback((source: HTMLElement, target: HTMLElement) => {
    const sourceMax = source.scrollHeight - source.clientHeight;
    const targetMax = target.scrollHeight - target.clientHeight;
    const nextTop = sourceMax > 0 && targetMax > 0 ? (source.scrollTop / sourceMax) * targetMax : 0;

    isSyncingScrollRef.current = true;
    target.scrollTop = nextTop;

    if (syncScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(syncScrollFrameRef.current);
    }

    syncScrollFrameRef.current = window.requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
      syncScrollFrameRef.current = null;
    });
  }, []);

  const openFilePath = useCallback(async (path: string) => {
    logDebug("info", "opening file path", { path });
    const file = await readTextFile(path);
    setContent(file.content);
    setCurrentFile(file.path);
    window.localStorage.setItem(LAST_FILE_STORAGE_KEY, file.path);
    setModified(false);
    setError(null);
    logDebug("info", "opened file path", { path: file.path, chars: file.content.length });
  }, []);

  const refreshVaultFiles = useCallback(async (path = vaultPath) => {
    if (!path) {
      setVaultFiles([]);
      return;
    }

    setIsVaultFilesLoading(true);
    try {
      setVaultFiles(await listVaultFiles(path));
    } catch (vaultListError) {
      showError("Vault list failed", vaultListError instanceof Error ? vaultListError.message : String(vaultListError));
    } finally {
      setIsVaultFilesLoading(false);
    }
  }, [showError, vaultPath]);

  const openVaultFolderPicker = useCallback(async (startPath?: string | null) => {
    const selected = await open({
      multiple: false,
      directory: true,
      title: "Choose where Hotaru should create or use hotaru-valut",
      defaultPath: startPath ?? undefined,
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
    window.localStorage.setItem(EDITOR_FONT_SIZE_STORAGE_KEY, String(editorFontSize));
  }, [editorFontSize]);

  useEffect(() => {
    window.localStorage.setItem(EDITOR_LINE_HEIGHT_STORAGE_KEY, String(editorLineHeight));
  }, [editorLineHeight]);

  useEffect(() => {
    window.localStorage.setItem(PREVIEW_FONT_SIZE_STORAGE_KEY, String(previewFontSize));
  }, [previewFontSize]);

  useEffect(() => {
    window.localStorage.setItem(PREVIEW_LINE_HEIGHT_STORAGE_KEY, String(previewLineHeight));
  }, [previewLineHeight]);

  useEffect(() => {
    window.localStorage.setItem(UI_FONT_SIZE_STORAGE_KEY, String(uiFontSize));
  }, [uiFontSize]);

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

        const startupFile = await getStartupFilePath();
        if (startupFile) {
          await openFilePath(startupFile);
          return;
        }

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
  }, [createAndOpenVaultNote, openFilePath, showError]);

  useEffect(() => {
    if (currentFile) {
      window.localStorage.setItem(LAST_FILE_STORAGE_KEY, currentFile);
    }
  }, [currentFile]);

  useEffect(() => {
    void refreshVaultFiles();
  }, [refreshVaultFiles]);

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
    setActiveSearchIndex(0);
    setHasSearchSelection(false);
  }, [searchMatches]);

  useEffect(() => {
    if (!isPreviewVisible) {
      return;
    }

    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) {
      return;
    }
    const editorElement = editor;
    const previewElement = preview;

    function handleEditorScroll() {
      if (isSyncingScrollRef.current) {
        return;
      }
      syncScrollPosition(editorElement, previewElement);
    }

    function handlePreviewScroll() {
      if (isSyncingScrollRef.current) {
        return;
      }
      syncScrollPosition(previewElement, editorElement);
    }

    const alignPreviewFrame = window.requestAnimationFrame(() => {
      syncScrollPosition(editorElement, previewElement);
    });

    editorElement.addEventListener("scroll", handleEditorScroll, { passive: true });
    previewElement.addEventListener("scroll", handlePreviewScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(alignPreviewFrame);
      editorElement.removeEventListener("scroll", handleEditorScroll);
      previewElement.removeEventListener("scroll", handlePreviewScroll);

      if (syncScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(syncScrollFrameRef.current);
        syncScrollFrameRef.current = null;
      }
      isSyncingScrollRef.current = false;
    };
  }, [content, isPreviewVisible, syncScrollPosition]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menubarRef.current?.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setActiveMenu(null);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();
        moveSearch(event.shiftKey ? -1 : 1);
        return;
      }

      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moveSearch]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    async function listenForFileDrops() {
      logDebug("info", "installing file drop listener");
      unlisten = await getCurrentWindow().onDragDropEvent((event) => {
        const dragEvent = event.payload;

        if (dragEvent.type === "enter" || dragEvent.type === "over") {
          if (dragEvent.type === "enter") {
            logDebug("info", "file drag entered", { paths: dragEvent.paths });
          }
          setIsFileDragOver(true);
          return;
        }

        setIsFileDragOver(false);

        if (dragEvent.type !== "drop") {
          logDebug("info", "file drag cancelled", { type: dragEvent.type });
          return;
        }

        logDebug("info", "file dropped", { paths: dragEvent.paths });
        const [path] = dragEvent.paths;
        if (!path) {
          showError("Drop failed", "The drop did not include a file path.");
          return;
        }

        if (dragEvent.paths.length > 1) {
          showError("Drop failed", "Drop one file at a time.");
          return;
        }

        void openFilePath(path).catch((dropError: unknown) => {
          logDebug("error", "failed to open dropped file", dropError);
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
      await refreshVaultFiles(preparedVault);
    } catch (newError) {
      showError("New note failed", newError instanceof Error ? newError.message : String(newError));
    }
  }, [createAndOpenVaultNote, ensureVaultReady, refreshVaultFiles, showError]);

  const handleOpen = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "All Files", extensions: ["*"] },
          { name: "Text, Markdown, and JSON", extensions: ["txt", "md", "markdown", "json"] },
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

  const handleOpenInNewInstance = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "All Files", extensions: ["*"] },
          { name: "Text, Markdown, and JSON", extensions: ["txt", "md", "markdown", "json"] },
        ],
      });

      if (typeof selected !== "string") {
        return;
      }

      await openFileInNewInstance(selected);
    } catch (openError) {
      showError("Open in new instance failed", openError instanceof Error ? openError.message : String(openError));
    }
  }, [showError]);

  const handleShowFileProperties = useCallback(async () => {
    if (!currentFile) {
      showError("File properties unavailable", "Save or open a file before viewing file properties.");
      return;
    }

    try {
      setFileProperties(await getFileProperties(currentFile));
      setError(null);
    } catch (propertiesError) {
      showError("File properties failed", propertiesError instanceof Error ? propertiesError.message : String(propertiesError));
    }
  }, [currentFile, showError]);

  const handleOpenVaultFileInNewInstance = useCallback(async (path: string) => {
    try {
      await openFileInNewInstance(path);
    } catch (openError) {
      showError("Open vault file failed", openError instanceof Error ? openError.message : String(openError));
    }
  }, [showError]);

  const handleSetVault = useCallback(() => {
    setIsVaultSettingsOpen(true);
  }, []);

  const handleChangeVaultLocation = useCallback(async () => {
    try {
      const preparedVault = await openVaultFolderPicker(vaultPath ?? window.localStorage.getItem(VAULT_STORAGE_KEY));
      if (!preparedVault) {
        return;
      }

      await createAndOpenVaultNote(preparedVault);
      await refreshVaultFiles(preparedVault);
      setIsVaultSettingsOpen(false);
    } catch (vaultError) {
      showError("Vault setup failed", vaultError instanceof Error ? vaultError.message : String(vaultError));
    }
  }, [createAndOpenVaultNote, openVaultFolderPicker, refreshVaultFiles, showError, vaultPath]);

  const handleSaveAs = useCallback(async () => {
    try {
      const selected = await save({
        filters: [
          { name: "All Files", extensions: ["*"] },
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
      if (isInsideVault(selected, vaultPath)) {
        await refreshVaultFiles();
      }
    } catch (saveError) {
      showError("Save failed", saveError instanceof Error ? saveError.message : String(saveError));
    }
  }, [content, refreshVaultFiles, showError, vaultPath]);

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
        await refreshVaultFiles(preparedVault);
      } catch (saveError) {
        showError("Save failed", saveError instanceof Error ? saveError.message : String(saveError));
      }
      return;
    }

    try {
      await writeTextFile(currentFile, content);
      setModified(false);
      setError(null);
      if (isInsideVault(currentFile, vaultPath)) {
        await refreshVaultFiles();
      }
    } catch (saveError) {
      showError("Save failed", saveError instanceof Error ? saveError.message : String(saveError));
    }
  }, [content, createVaultNote, currentFile, ensureVaultReady, refreshVaultFiles, showError, vaultPath]);

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
    <main className="app-shell" data-theme={themeMode} data-file-drag-over={isFileDragOver} style={appStyle}>
      <header className="menubar-shell">
        <nav className="menubar" aria-label="Application menu" ref={menubarRef}>
          <div className="menu-root" data-open={activeMenu === "file"} onMouseEnter={() => activeMenu && setActiveMenu("file")}>
            <button className="menu-title" aria-expanded={activeMenu === "file"} onClick={() => setActiveMenu((menu) => (menu === "file" ? null : "file"))}>File</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(handleNew)}>New</button>
              <button role="menuitem" onClick={() => runMenuAction(handleOpen)}>Open...</button>
              <button role="menuitem" onClick={() => runMenuAction(handleOpenInNewInstance)}>Open in New Instance...</button>
              <button role="menuitem" onClick={() => runMenuAction(handleSave)}>Save</button>
              <button role="menuitem" onClick={() => runMenuAction(handleSaveAs)}>Save As...</button>
              <button role="menuitem" onClick={() => runMenuAction(handleShowFileProperties)} disabled={!currentFile}>File Properties...</button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={() => runMenuAction(handleSetVault)}>Vault...</button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={() => runMenuAction(handleExit)}>Exit</button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "view"} onMouseEnter={() => activeMenu && setActiveMenu("view")}>
            <button className="menu-title" aria-expanded={activeMenu === "view"} onClick={() => setActiveMenu((menu) => (menu === "view" ? null : "view"))}>View</button>
            <div className="menu-popover" role="menu">
              <button role="menuitemradio" aria-checked={themeMode === "system"} onClick={() => runMenuAction(() => setThemeMode("system"))}>
                {themeMode === "system" ? "[x] " : ""}System Theme
              </button>
              <button role="menuitemradio" aria-checked={themeMode === "light"} onClick={() => runMenuAction(() => setThemeMode("light"))}>
                {themeMode === "light" ? "[x] " : ""}Light Theme
              </button>
              <button role="menuitemradio" aria-checked={themeMode === "dark"} onClick={() => runMenuAction(() => setThemeMode("dark"))}>
                {themeMode === "dark" ? "[x] " : ""}Dark Theme
              </button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={() => runMenuAction(() => setSplitPercent(50))}>Reset Split</button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "settings"} onMouseEnter={() => activeMenu && setActiveMenu("settings")}>
            <button className="menu-title" aria-expanded={activeMenu === "settings"} onClick={() => setActiveMenu((menu) => (menu === "settings" ? null : "settings"))}>Settings</button>
            <div className="menu-popover vault-menu" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(handleOpenInNewInstance)}>Open File in New Instance...</button>
              <button role="menuitem" onClick={() => runMenuAction(() => setIsAppearanceSettingsOpen(true))}>Appearance...</button>
              <button role="menuitem" onClick={() => runMenuAction(() => refreshVaultFiles())} disabled={!vaultPath || isVaultFilesLoading}>
                {isVaultFilesLoading ? "Refreshing Vault..." : "Refresh Vault Files"}
              </button>
              <div className="menu-separator" />
              <div className="menu-label">Vault Files</div>
              {!vaultPath && <div className="menu-empty">No vault selected</div>}
              {vaultPath && vaultFiles.length === 0 && <div className="menu-empty">No files in vault</div>}
              {vaultFiles.map((file) => (
                <button
                  key={file.path}
                  role="menuitem"
                  title={`${file.path}\nModified: ${formatFileDate(file.modifiedMs)}`}
                  onClick={() => runMenuAction(() => handleOpenVaultFileInNewInstance(file.path))}
                >
                  {file.name}
                </button>
              ))}
            </div>
          </div>

          <button
            className="menu-title preview-toggle"
            type="button"
            aria-pressed={isPreviewVisible}
            onMouseEnter={() => activeMenu && setActiveMenu(null)}
            onClick={() => {
              setActiveMenu(null);
              setIsPreviewVisible((visible) => !visible);
            }}
          >
            Preview
          </button>

          <div className="menu-root" data-open={activeMenu === "format"} onMouseEnter={() => activeMenu && setActiveMenu("format")}>
            <button className="menu-title" aria-expanded={activeMenu === "format"} onClick={() => setActiveMenu((menu) => (menu === "format" ? null : "format"))}>Format</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(handleFormatJson)}>Format JSON</button>
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
            <div className="pane-title">
              <span>Editor</span>
              <small>{currentFile ?? "Untitled"}</small>
            </div>
            <div className="search-box" role="search">
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    moveSearch(event.shiftKey ? -1 : 1);
                  } else if (event.key === "Escape") {
                    setSearchQuery("");
                    setHasSearchSelection(false);
                    editorRef.current?.focus();
                  }
                }}
                placeholder="Search"
                aria-label="Search editor text"
              />
              <button type="button" onClick={() => moveSearch(-1)} disabled={searchMatches.length === 0} aria-label="Previous match">
                Prev
              </button>
              <button type="button" onClick={() => moveSearch(1)} disabled={searchMatches.length === 0} aria-label="Next match">
                Next
              </button>
              <span aria-live="polite">
                {searchQuery ? `${hasSearchSelection ? activeSearchIndex + 1 : 0}/${searchMatches.length}` : "0/0"}
              </span>
            </div>
          </header>
          <textarea
            ref={editorRef}
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
                themeMode={themeMode}
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

      {fileProperties && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="file-properties-title">
          <div className="file-properties-modal">
            <header className="modal-toolbar">
              <div>
                <strong id="file-properties-title">File Properties</strong>
                <span>{fileProperties.path}</span>
              </div>
              <button type="button" onClick={() => setFileProperties(null)}>Close</button>
            </header>
            <dl className="file-properties-grid">
              <dt>Path</dt>
              <dd>{fileProperties.path}</dd>
              <dt>Created</dt>
              <dd>{formatFileDate(fileProperties.createdMs)}</dd>
              <dt>Modified</dt>
              <dd>{formatFileDate(fileProperties.modifiedMs)}</dd>
              <dt>Size</dt>
              <dd>{fileProperties.size.toLocaleString()} bytes</dd>
            </dl>
          </div>
        </section>
      )}

      {isVaultSettingsOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="vault-settings-title">
          <div className="file-properties-modal">
            <header className="modal-toolbar">
              <div>
                <strong id="vault-settings-title">Vault Settings</strong>
                <span>{vaultPath ?? "No vault selected"}</span>
              </div>
              <button type="button" onClick={() => setIsVaultSettingsOpen(false)}>Close</button>
            </header>
            <div className="vault-settings-body">
              <div>
                <span>Vault Path</span>
                <input readOnly value={vaultPath ?? "No vault selected"} aria-label="Current vault path" />
              </div>
              <button type="button" onClick={handleChangeVaultLocation}>Change Vault Location...</button>
            </div>
          </div>
        </section>
      )}

      {isAppearanceSettingsOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="appearance-settings-title">
          <div className="file-properties-modal">
            <header className="modal-toolbar">
              <div>
                <strong id="appearance-settings-title">Appearance</strong>
                <span>Editor, preview, and interface text settings</span>
              </div>
              <button type="button" onClick={() => setIsAppearanceSettingsOpen(false)}>Close</button>
            </header>
            <div className="appearance-settings-body">
              <label>
                <span>Editor Font Size</span>
                <input type="range" min="10" max="28" step="1" value={editorFontSize} onChange={(event) => setEditorFontSize(Number(event.target.value))} />
                <output>{editorFontSize}px</output>
              </label>
              <label>
                <span>Editor Line Height</span>
                <input type="range" min="1.1" max="2.4" step="0.05" value={editorLineHeight} onChange={(event) => setEditorLineHeight(Number(event.target.value))} />
                <output>{editorLineHeight.toFixed(2)}</output>
              </label>
              <label>
                <span>Preview Font Size</span>
                <input type="range" min="10" max="30" step="1" value={previewFontSize} onChange={(event) => setPreviewFontSize(Number(event.target.value))} />
                <output>{previewFontSize}px</output>
              </label>
              <label>
                <span>Preview Line Height</span>
                <input type="range" min="1.1" max="2.4" step="0.05" value={previewLineHeight} onChange={(event) => setPreviewLineHeight(Number(event.target.value))} />
                <output>{previewLineHeight.toFixed(2)}</output>
              </label>
              <label>
                <span>Interface Font Size</span>
                <input type="range" min="10" max="18" step="1" value={uiFontSize} onChange={(event) => setUiFontSize(Number(event.target.value))} />
                <output>{uiFontSize}px</output>
              </label>
              <button
                type="button"
                onClick={() => {
                  setEditorFontSize(14);
                  setEditorLineHeight(1.55);
                  setPreviewFontSize(16);
                  setPreviewLineHeight(1.65);
                  setUiFontSize(13);
                }}
              >
                Reset Appearance
              </button>
            </div>
          </div>
        </section>
      )}

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
