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
import { COMMAND_DEFINITIONS, isPrimaryShortcut, type CommandId } from "./commands";
import { BUILD_INFO } from "./buildInfo";
import { CommandPalette } from "./components/CommandPalette";
import { MarkdownEditor, type EditorMode, type MarkdownEditorHandle } from "./components/MarkdownEditor";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { VaultSidebar, type VaultSearchMode, type VaultSort } from "./components/VaultSidebar";
import { logDebug } from "./debugLog";
import {
  createNamedVaultNote,
  createVaultNote,
  deleteVaultFile,
  duplicateVaultFile,
  ensureDefaultHotaruVault,
  ensureHotaruVault,
  exitApp,
  getFileProperties,
  getStartupFilePath,
  getVaultBacklinks,
  listVaultFiles,
  openFileInNewInstance,
  readTextFile,
  renameVaultFile,
  searchVaultText,
  writeTextFile,
} from "./tauri";
import type { Backlink, FileProperties, VaultFile, VaultSearchMatch } from "./tauri";
import type { EditorError, ExcalidrawScene } from "./types";
import { saveCurrentWindowState } from "./windowState";
import { buildStandaloneHtml, markdownToHtml } from "./exportHtml";

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
type MenuId = "file" | "view" | "settings" | "search" | "format";

const EMPTY_DOCUMENT = "";
const THEME_STORAGE_KEY = "hotaru-theme";
const LEGACY_THEME_STORAGE_KEY = "rust-text-editor-theme";
const SPLIT_STORAGE_KEY = "hotaru-split";
const LEGACY_SPLIT_STORAGE_KEY = "rust-text-editor-split";
const VAULT_STORAGE_KEY = "hotaru-vault-path";
const LAST_FILE_STORAGE_KEY = "hotaru-last-file";
const EDITOR_MODE_STORAGE_KEY = "hotaru-editor-mode";
const SIDEBAR_STORAGE_KEY = "hotaru-sidebar-visible";
const EDITOR_FONT_SIZE_STORAGE_KEY = "hotaru-editor-font-size";
const EDITOR_LINE_HEIGHT_STORAGE_KEY = "hotaru-editor-line-height";
const PREVIEW_FONT_SIZE_STORAGE_KEY = "hotaru-preview-font-size";
const PREVIEW_LINE_HEIGHT_STORAGE_KEY = "hotaru-preview-line-height";
const UI_FONT_SIZE_STORAGE_KEY = "hotaru-ui-font-size";
const VAULT_FILE_FONT_SIZE_STORAGE_KEY = "hotaru-vault-file-font-size";
const VAULT_SIDEBAR_WIDTH_STORAGE_KEY = "hotaru-vault-sidebar-width";

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

function fileStem(path: string) {
  const fileName = path.replace(/\\/g, "/").split("/").pop() ?? path;
  return fileName.replace(/\.[^.]+$/, "");
}

function sanitizeNoteName(name: string) {
  return name.trim().replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ").slice(0, 80) || "Untitled";
}

function cycleEditorMode(mode: EditorMode): EditorMode {
  return mode === "split" ? "source" : "split";
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
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isVaultFilesLoading, setIsVaultFilesLoading] = useState(false);
  const [vaultFilter, setVaultFilter] = useState("");
  const [vaultSort, setVaultSort] = useState<VaultSort>("modified");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    const saved = window.localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
    return saved === "source" || saved === "split" ? saved : "split";
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "false";
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
  const [vaultFileFontSize, setVaultFileFontSize] = useState(() => readStoredNumber(VAULT_FILE_FONT_SIZE_STORAGE_KEY, 13, 10, 18));
  const [vaultSidebarWidth, setVaultSidebarWidth] = useState(() => readStoredNumber(VAULT_SIDEBAR_WIDTH_STORAGE_KEY, 340, 220, 520));
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = Number(readStoredValue(SPLIT_STORAGE_KEY, LEGACY_SPLIT_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= 25 && saved <= 75 ? saved : 58;
  });
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [hasSearchSelection, setHasSearchSelection] = useState(false);
  const [vaultSearchMode, setVaultSearchMode] = useState<VaultSearchMode>("files");
  const [vaultContentResults, setVaultContentResults] = useState<VaultSearchMatch[]>([]);
  const [isVaultContentSearching, setIsVaultContentSearching] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isDraggingVaultSidebar, setIsDraggingVaultSidebar] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const menubarRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const vaultSearchInputRef = useRef<HTMLInputElement>(null);
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
    "--vault-file-font-size": `${vaultFileFontSize}px`,
    "--vault-sidebar-width": `${vaultSidebarWidth}px`,
  }) as CSSProperties, [editorFontSize, editorLineHeight, previewFontSize, previewLineHeight, uiFontSize, vaultFileFontSize, vaultSidebarWidth]);
  const currentVaultFile = useMemo(() => vaultFiles.find((file) => file.path === currentFile) ?? null, [currentFile, vaultFiles]);
  const filteredVaultFiles = useMemo(() => {
    const normalizedFilter = vaultFilter.trim().toLowerCase();
    const tagFilter = normalizedFilter.startsWith("tag:")
      ? normalizedFilter.slice(4).replace(/^#/, "")
      : normalizedFilter.startsWith("#")
        ? normalizedFilter.slice(1)
        : null;
    const files = normalizedFilter
      ? vaultFiles.filter((file) => {
        if (tagFilter !== null) {
          return file.tags.some((tag) => tag.toLowerCase().includes(tagFilter));
        }
        return file.relativePath.toLowerCase().includes(normalizedFilter)
          || file.tags.some((tag) => tag.toLowerCase().includes(normalizedFilter));
      })
      : vaultFiles;

    return [...files].sort((left, right) => {
      if (vaultSort === "modified") {
        return (right.modifiedMs ?? 0) - (left.modifiedMs ?? 0);
      }
      if (vaultSort === "size") {
        return right.size - left.size;
      }
      return left.relativePath.toLowerCase().localeCompare(right.relativePath.toLowerCase());
    });
  }, [vaultFiles, vaultFilter, vaultSort]);
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
  const isSplitMode = editorMode === "split";

  useEffect(() => {
    document.title = `Hotaru build ${BUILD_INFO.buildNumber} updated ${BUILD_INFO.updatedAt}`;
  }, []);

  const disabledCommands = useMemo(() => {
    const disabled = new Set<CommandId>();
    if (!currentFile) {
      disabled.add("file.rename");
      disabled.add("file.delete");
      disabled.add("file.duplicate");
    }
    if (!vaultPath) {
      disabled.add("search.vault");
    }
    return disabled;
  }, [currentFile, vaultPath]);

  const showError = useCallback((title: string, message: string) => {
    setError({ title, message });
  }, []);

  const runMenuAction = useCallback((action: () => void | Promise<void>) => {
    setActiveMenu(null);
    void action();
  }, []);

  const selectSearchMatch = useCallback((matchIndex: number) => {
    const start = searchMatches[matchIndex];
    if (start === undefined) {
      return;
    }

    editorRef.current?.selectRange(start, start + searchQuery.length);
  }, [searchMatches, searchQuery]);

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

  const openFilePath = useCallback(async (path: string) => {
    if (modified && currentFile && !isInsideVault(currentFile, vaultPath)) {
      const shouldDiscard = window.confirm("The current external file has unsaved changes. Discard them and open another file?");
      if (!shouldDiscard) {
        return;
      }
    }

    logDebug("info", "opening file path", { path });
    const file = await readTextFile(path);
    setContent(file.content);
    setCurrentFile(file.path);
    window.localStorage.setItem(LAST_FILE_STORAGE_KEY, file.path);
    setModified(false);
    setError(null);
    logDebug("info", "opened file path", { path: file.path, chars: file.content.length });
  }, [currentFile, modified, vaultPath]);

  const openVaultFolderPicker = useCallback(async (startPath?: string | null) => {
    const selected = await open({
      multiple: false,
      directory: true,
      title: "Choose a folder to use as the Hotaru vault",
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

  const handleSave = useCallback(async () => {
    if (!currentFile) {
      try {
        const preparedVault = await ensureVaultReady();
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
  }, [content, currentFile, ensureVaultReady, refreshVaultFiles, showError, vaultPath]);

  const handleNew = useCallback(async () => {
    try {
      const preparedVault = await ensureVaultReady();
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

      if (typeof selected === "string") {
        await openFilePath(selected);
      }
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

      if (typeof selected === "string") {
        await openFileInNewInstance(selected);
      }
    } catch (openError) {
      showError("Open in new instance failed", openError instanceof Error ? openError.message : String(openError));
    }
  }, [showError]);

  const handleOpenVaultFileInNewInstance = useCallback(async (path: string) => {
    try {
      await openFileInNewInstance(path);
    } catch (openError) {
      showError("Open vault file failed", openError instanceof Error ? openError.message : String(openError));
    }
  }, [showError]);

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

  const handleExportHtml = useCallback(async () => {
    try {
      const fallbackName = currentVaultFile?.name
        ?? (currentFile ? currentFile.split(/[\\/]/).pop() : null)
        ?? "hotaru-note.md";
      const defaultName = fallbackName.replace(/\.(md|markdown|txt)$/i, "") || "hotaru-note";
      const selected = await save({
        defaultPath: `${defaultName}.html`,
        filters: [
          { name: "HTML", extensions: ["html", "htm"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!selected) {
        return;
      }

      await writeTextFile(selected, buildStandaloneHtml({
        title: defaultName,
        bodyHtml: markdownToHtml(content),
      }));
      setError(null);
    } catch (exportError) {
      showError("HTML export failed", exportError instanceof Error ? exportError.message : String(exportError));
    }
  }, [content, currentFile, currentVaultFile?.name, showError]);

  const openVaultContentSearch = useCallback(() => {
    if (!vaultPath) {
      showError("Vault search unavailable", "Choose a vault before searching note contents.");
      return;
    }
    setIsSidebarCollapsed(false);
    setVaultSearchMode("contents");
    window.setTimeout(() => {
      vaultSearchInputRef.current?.focus();
      vaultSearchInputRef.current?.select();
    }, 0);
  }, [showError, vaultPath]);

  const clearVaultSearch = useCallback(() => {
    setVaultFilter("");
    setVaultSearchMode("files");
    setVaultContentResults([]);
    setIsVaultContentSearching(false);
  }, []);

  const openVaultSearchResult = useCallback(async (result: VaultSearchMatch) => {
    await openFilePath(result.path);
    setSearchQuery(vaultFilter);
    setHasSearchSelection(true);
    window.setTimeout(() => {
      editorRef.current?.selectRange(result.matchStart, result.matchEnd);
    }, 0);
  }, [openFilePath, vaultFilter]);

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

  const handleRenameVaultFile = useCallback(async (file: VaultFile | null = currentVaultFile) => {
    if (!vaultPath || !file) {
      showError("Rename unavailable", "Open or select a vault file before renaming.");
      return;
    }

    const nextPath = window.prompt("Rename vault file", file.relativePath);
    if (!nextPath || nextPath === file.relativePath) {
      return;
    }

    try {
      await handleSave();
      const renamed = await renameVaultFile(vaultPath, file.path, nextPath);
      if (currentFile === file.path) {
        setCurrentFile(renamed.path);
        setContent(renamed.content);
        window.localStorage.setItem(LAST_FILE_STORAGE_KEY, renamed.path);
      }
      setModified(false);
      await refreshVaultFiles(vaultPath);
    } catch (renameError) {
      showError("Rename failed", renameError instanceof Error ? renameError.message : String(renameError));
    }
  }, [currentFile, currentVaultFile, handleSave, refreshVaultFiles, showError, vaultPath]);

  const handleDeleteVaultFile = useCallback(async (file: VaultFile | null = currentVaultFile) => {
    if (!vaultPath || !file) {
      showError("Delete unavailable", "Open or select a vault file before deleting.");
      return;
    }

    const shouldDelete = window.confirm(`Delete ${file.relativePath}? This cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    try {
      await deleteVaultFile(vaultPath, file.path);
      if (currentFile === file.path) {
        setContent(EMPTY_DOCUMENT);
        setCurrentFile(null);
        setModified(false);
        window.localStorage.removeItem(LAST_FILE_STORAGE_KEY);
      }
      await refreshVaultFiles(vaultPath);
    } catch (deleteError) {
      showError("Delete failed", deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }, [currentFile, currentVaultFile, refreshVaultFiles, showError, vaultPath]);

  const handleDuplicateVaultFile = useCallback(async (file: VaultFile | null = currentVaultFile) => {
    if (!vaultPath || !file) {
      showError("Duplicate unavailable", "Open or select a vault file before duplicating.");
      return;
    }

    try {
      await handleSave();
      const duplicate = await duplicateVaultFile(vaultPath, file.path);
      setContent(duplicate.content);
      setCurrentFile(duplicate.path);
      window.localStorage.setItem(LAST_FILE_STORAGE_KEY, duplicate.path);
      setModified(false);
      await refreshVaultFiles(vaultPath);
    } catch (duplicateError) {
      showError("Duplicate failed", duplicateError instanceof Error ? duplicateError.message : String(duplicateError));
    }
  }, [currentVaultFile, handleSave, refreshVaultFiles, showError, vaultPath]);

  const handleWikiLink = useCallback(async (name: string) => {
    const preparedVault = await ensureVaultReady();
    const normalizedName = sanitizeNoteName(name);
    const existing = vaultFiles.find((file) => fileStem(file.relativePath).toLowerCase() === normalizedName.toLowerCase());
    if (existing) {
      await openFilePath(existing.path);
      return;
    }

    try {
      const created = await createNamedVaultNote(preparedVault, `${normalizedName}.md`, `# ${normalizedName}\n`);
      setContent(created.content);
      setCurrentFile(created.path);
      window.localStorage.setItem(LAST_FILE_STORAGE_KEY, created.path);
      setModified(false);
      await refreshVaultFiles(preparedVault);
    } catch (wikiError) {
      showError("Wiki link failed", wikiError instanceof Error ? wikiError.message : String(wikiError));
    }
  }, [ensureVaultReady, openFilePath, refreshVaultFiles, showError, vaultFiles]);

  const handleFormatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(content);
      setContent(`${JSON.stringify(parsed, null, 2)}\n`);
      setModified(true);
      setError(null);
    } catch (formatError) {
      showError("JSON format failed", formatError instanceof Error ? formatError.message : String(formatError));
    }
  }, [content, showError]);

  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    setModified(true);
  }, []);

  const handleChangeVaultLocation = useCallback(async () => {
    try {
      if (modified) {
        const shouldSwitch = window.confirm("The current note has unsaved changes. Switch vault and discard them?");
        if (!shouldSwitch) {
          return;
        }
      }

      const preparedVault = await openVaultFolderPicker(vaultPath ?? window.localStorage.getItem(VAULT_STORAGE_KEY));
      if (!preparedVault) {
        return;
      }

      await refreshVaultFiles(preparedVault);
      setIsVaultSettingsOpen(false);
    } catch (vaultError) {
      showError("Vault setup failed", vaultError instanceof Error ? vaultError.message : String(vaultError));
    }
  }, [modified, openVaultFolderPicker, refreshVaultFiles, showError, vaultPath]);

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

  const runCommand = useCallback((commandId: CommandId) => {
    setActiveMenu(null);
    setIsCommandPaletteOpen(false);
    setCommandQuery("");
    switch (commandId) {
      case "file.new":
        void handleNew();
        break;
      case "file.open":
        void handleOpen();
        break;
      case "file.save":
        void handleSave();
        break;
      case "file.saveAs":
        void handleSaveAs();
        break;
      case "file.exportHtml":
        void handleExportHtml();
        break;
      case "file.rename":
        void handleRenameVaultFile();
        break;
      case "file.delete":
        void handleDeleteVaultFile();
        break;
      case "file.duplicate":
        void handleDuplicateVaultFile();
        break;
      case "view.toggleSidebar":
        setIsSidebarCollapsed((collapsed) => !collapsed);
        break;
      case "view.cycleEditorMode":
        setEditorMode((mode) => cycleEditorMode(mode));
        break;
      case "view.togglePreview":
        setEditorMode((mode) => (mode === "split" ? "source" : "split"));
        break;
      case "view.commandPalette":
        setIsCommandPaletteOpen(true);
        break;
      case "search.note":
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        break;
      case "search.vault":
        openVaultContentSearch();
        break;
      case "format.bold":
        editorRef.current?.wrapSelection("**", "**", "bold text");
        break;
      case "format.italic":
        editorRef.current?.wrapSelection("_", "_", "italic text");
        break;
      case "format.link":
        editorRef.current?.wrapSelection("[", "](url)", "link text");
        break;
      case "format.json":
        handleFormatJson();
        break;
    }
  }, [
    handleDeleteVaultFile,
    handleDuplicateVaultFile,
    handleExportHtml,
    handleFormatJson,
    handleNew,
    handleOpen,
    handleRenameVaultFile,
    handleSave,
    handleSaveAs,
    openVaultContentSearch,
  ]);

  const updateSplitFromPointer = useCallback((clientX: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    const next = ((clientX - bounds.left) / bounds.width) * 100;
    setSplitPercent(Math.min(75, Math.max(25, next)));
  }, []);

  const updateVaultSidebarWidthFromPointer = useCallback((clientX: number) => {
    setVaultSidebarWidth(Math.min(520, Math.max(220, clientX)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(splitPercent));
  }, [splitPercent]);

  useEffect(() => {
    window.localStorage.setItem(EDITOR_MODE_STORAGE_KEY, editorMode);
  }, [editorMode]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!isSidebarCollapsed));
  }, [isSidebarCollapsed]);

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
    window.localStorage.setItem(VAULT_FILE_FONT_SIZE_STORAGE_KEY, String(vaultFileFontSize));
  }, [vaultFileFontSize]);

  useEffect(() => {
    window.localStorage.setItem(VAULT_SIDEBAR_WIDTH_STORAGE_KEY, String(vaultSidebarWidth));
  }, [vaultSidebarWidth]);

  useEffect(() => {
    if (vaultSearchMode !== "contents" || !vaultPath) {
      setVaultContentResults([]);
      setIsVaultContentSearching(false);
      return;
    }

    const query = vaultFilter.trim();
    if (!query) {
      setVaultContentResults([]);
      setIsVaultContentSearching(false);
      return;
    }

    let cancelled = false;
    setIsVaultContentSearching(true);
    const timer = window.setTimeout(() => {
      void searchVaultText(vaultPath, query, 200)
        .then((results) => {
          if (!cancelled) {
            setVaultContentResults(results);
            setError(null);
          }
        })
        .catch((searchError: unknown) => {
          if (!cancelled) {
            showError("Vault search failed", searchError instanceof Error ? searchError.message : String(searchError));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsVaultContentSearching(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showError, vaultFilter, vaultPath, vaultSearchMode]);

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
            showError("Restore failed", restoreError instanceof Error ? restoreError.message : String(restoreError));
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
    if (!vaultPath || !currentFile || !isInsideVault(currentFile, vaultPath)) {
      setBacklinks([]);
      return;
    }

    void getVaultBacklinks(vaultPath, currentFile)
      .then(setBacklinks)
      .catch((backlinkError: unknown) => {
        showError("Backlink scan failed", backlinkError instanceof Error ? backlinkError.message : String(backlinkError));
      });
  }, [content, currentFile, showError, vaultPath]);

  useEffect(() => {
    if (!currentFile || !isInsideVault(currentFile, vaultPath) || isVaultInitializing) {
      return;
    }

    const vaultFile = currentFile;
    const saveTimer = window.setTimeout(() => {
      void writeTextFile(vaultFile, content)
        .then(async () => {
          setModified(false);
          await refreshVaultFiles();
        })
        .catch((autosaveError: unknown) => {
          showError("Vault autosave failed", autosaveError instanceof Error ? autosaveError.message : String(autosaveError));
        });
    }, 600);

    return () => window.clearTimeout(saveTimer);
  }, [content, currentFile, isVaultInitializing, refreshVaultFiles, showError, vaultPath]);

  useEffect(() => {
    setActiveSearchIndex(0);
    setHasSearchSelection(false);
  }, [searchMatches]);

  useEffect(() => {
    if (!isSplitMode) {
      return;
    }

    const editor = editorRef.current?.getScrollElement();
    const preview = previewRef.current;
    if (!editor || !preview) {
      return;
    }
    const editorElement = editor;
    const previewElement = preview;

    function handleEditorScroll() {
      if (!isSyncingScrollRef.current) {
        syncScrollPosition(editorElement, previewElement);
      }
    }
    function handlePreviewScroll() {
      if (!isSyncingScrollRef.current) {
        syncScrollPosition(previewElement, editorElement);
      }
    }

    editorElement.addEventListener("scroll", handleEditorScroll, { passive: true });
    previewElement.addEventListener("scroll", handlePreviewScroll, { passive: true });
    return () => {
      editorElement.removeEventListener("scroll", handleEditorScroll);
      previewElement.removeEventListener("scroll", handlePreviewScroll);
    };
  }, [content, isSplitMode, syncScrollPosition]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menubarRef.current?.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isCommandPaletteOpen && event.key === "Escape") {
        setIsCommandPaletteOpen(false);
        return;
      }
      if (isPrimaryShortcut(event, "k")) {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }
      if (isPrimaryShortcut(event, "n")) {
        event.preventDefault();
        runCommand("file.new");
        return;
      }
      if (isPrimaryShortcut(event, "o")) {
        event.preventDefault();
        runCommand("file.open");
        return;
      }
      if (isPrimaryShortcut(event, "s")) {
        event.preventDefault();
        runCommand("file.save");
        return;
      }
      if (isPrimaryShortcut(event, "f") && event.shiftKey) {
        event.preventDefault();
        runCommand("search.vault");
        return;
      }
      if (isPrimaryShortcut(event, "f")) {
        event.preventDefault();
        runCommand("search.note");
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        runCommand("view.cycleEditorMode");
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
        event.preventDefault();
        runCommand("view.toggleSidebar");
        return;
      }
      if (isPrimaryShortcut(event, "b")) {
        event.preventDefault();
        runCommand("format.bold");
        return;
      }
      if (isPrimaryShortcut(event, "i")) {
        event.preventDefault();
        runCommand("format.italic");
        return;
      }
      if (event.key === "F3") {
        event.preventDefault();
        moveSearch(event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === "Escape") {
        setActiveMenu(null);
        setIsCommandPaletteOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCommandPaletteOpen, moveSearch, runCommand]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    async function listenForFileDrops() {
      logDebug("info", "installing file drop listener");
      unlisten = await getCurrentWindow().onDragDropEvent((event) => {
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

  useEffect(() => {
    if (!isDraggingVaultSidebar) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      updateVaultSidebarWidthFromPointer(event.clientX);
    }
    function handlePointerUp() {
      setIsDraggingVaultSidebar(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    document.body.classList.add("resizing-pane");
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("resizing-pane");
    };
  }, [isDraggingVaultSidebar, updateVaultSidebarWidthFromPointer]);

  return (
    <main className="app-shell" data-theme={themeMode} data-file-drag-over={isFileDragOver} style={appStyle}>
      <header className="menubar-shell">
        <nav className="menubar" aria-label="Application menu" ref={menubarRef}>
          <div className="menu-root" data-open={activeMenu === "file"} onMouseEnter={() => activeMenu && setActiveMenu("file")}>
            <button className="menu-title" aria-expanded={activeMenu === "file"} onClick={() => setActiveMenu((menu) => (menu === "file" ? null : "file"))}>File</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(handleNew)}>New Vault Note <kbd>Ctrl+N</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(handleOpen)}>Open... <kbd>Ctrl+O</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(handleOpenInNewInstance)}>Open in New Instance...</button>
              <button role="menuitem" onClick={() => runMenuAction(handleSave)}>Save <kbd>Ctrl+S</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(handleSaveAs)}>Save As...</button>
              <button role="menuitem" onClick={() => runMenuAction(handleExportHtml)}>Export as HTML...</button>
              <button role="menuitem" onClick={() => runMenuAction(() => handleRenameVaultFile())} disabled={!currentVaultFile}>Rename...</button>
              <button role="menuitem" onClick={() => runMenuAction(() => handleDuplicateVaultFile())} disabled={!currentVaultFile}>Duplicate</button>
              <button role="menuitem" onClick={() => runMenuAction(() => handleDeleteVaultFile())} disabled={!currentVaultFile}>Delete...</button>
              <button role="menuitem" onClick={() => runMenuAction(handleShowFileProperties)} disabled={!currentFile}>File Properties...</button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={() => runMenuAction(() => setIsVaultSettingsOpen(true))}>Vault...</button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={() => runMenuAction(handleExit)}>Exit</button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "view"} onMouseEnter={() => activeMenu && setActiveMenu("view")}>
            <button className="menu-title" aria-expanded={activeMenu === "view"} onClick={() => setActiveMenu((menu) => (menu === "view" ? null : "view"))}>View</button>
            <div className="menu-popover" role="menu">
              <button role="menuitemradio" aria-checked={themeMode === "system"} onClick={() => runMenuAction(() => setThemeMode("system"))}>{themeMode === "system" ? "[x] " : ""}System Theme</button>
              <button role="menuitemradio" aria-checked={themeMode === "light"} onClick={() => runMenuAction(() => setThemeMode("light"))}>{themeMode === "light" ? "[x] " : ""}Light Theme</button>
              <button role="menuitemradio" aria-checked={themeMode === "dark"} onClick={() => runMenuAction(() => setThemeMode("dark"))}>{themeMode === "dark" ? "[x] " : ""}Dark Theme</button>
              <div className="menu-separator" />
              <button role="menuitemcheckbox" aria-checked={isSplitMode} onClick={() => runMenuAction(() => setEditorMode((mode) => (mode === "split" ? "source" : "split")))}>
                {isSplitMode ? "[x] " : ""}Preview Pane <kbd>Ctrl+Shift+V</kbd>
              </button>
              <button role="menuitem" onClick={() => runMenuAction(() => setIsSidebarCollapsed((collapsed) => !collapsed))}>Toggle Vault <kbd>Ctrl+\</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(() => setSplitPercent(58))}>Reset Split</button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "settings"} onMouseEnter={() => activeMenu && setActiveMenu("settings")}>
            <button className="menu-title" aria-expanded={activeMenu === "settings"} onClick={() => setActiveMenu((menu) => (menu === "settings" ? null : "settings"))}>Settings</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(() => setIsAppearanceSettingsOpen(true))}>Appearance...</button>
              <button role="menuitem" onClick={() => runMenuAction(() => refreshVaultFiles())} disabled={!vaultPath || isVaultFilesLoading}>
                {isVaultFilesLoading ? "Refreshing Vault..." : "Refresh Vault Files"}
              </button>
            </div>
          </div>

          <button className="menu-title preview-toggle" type="button" aria-pressed={isCommandPaletteOpen} onClick={() => setIsCommandPaletteOpen(true)}>
            Command <kbd>Ctrl+K</kbd>
          </button>

          <div className="menu-root" data-open={activeMenu === "search"} onMouseEnter={() => activeMenu && setActiveMenu("search")}>
            <button className="menu-title" aria-expanded={activeMenu === "search"} onClick={() => setActiveMenu((menu) => (menu === "search" ? null : "search"))}>Search</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(() => runCommand("search.note"))}>Find in Note <kbd>Ctrl+F</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(openVaultContentSearch)} disabled={!vaultPath}>Search Vault Contents <kbd>Ctrl+Shift+F</kbd></button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "format"} onMouseEnter={() => activeMenu && setActiveMenu("format")}>
            <button className="menu-title" aria-expanded={activeMenu === "format"} onClick={() => setActiveMenu((menu) => (menu === "format" ? null : "format"))}>Format</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(() => runCommand("format.bold"))}>Bold <kbd>Ctrl+B</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(() => runCommand("format.italic"))}>Italic <kbd>Ctrl+I</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(() => runCommand("format.link"))}>Insert Link</button>
              <button role="menuitem" onClick={() => runMenuAction(handleFormatJson)}>Format JSON</button>
            </div>
          </div>
        </nav>

        <div className="window-caption">
          <strong>Hotaru</strong>
          <span className="build-badge">build {BUILD_INFO.buildNumber}</span>
          <span className="build-updated">updated {BUILD_INFO.updatedAt}</span>
          <span>Vault notes, Markdown, Mermaid, Excalidraw</span>
        </div>
      </header>

      {error && (
        <section className="error-banner" role="alert">
          <div>
            <strong>{error.title}</strong>
            <span>{error.message}</span>
          </div>
          <button onClick={() => setError(null)} aria-label="Dismiss error">Dismiss</button>
        </section>
      )}

      {isFileDragOver && (
        <section className="drop-overlay" aria-live="polite">
          <strong>Drop to open</strong>
          <span>Release one text, Markdown, JSON, or Excalidraw file here.</span>
        </section>
      )}

      <section className="app-body">
        <VaultSidebar
          vaultPath={vaultPath}
          files={filteredVaultFiles}
          contentResults={vaultContentResults}
          backlinks={backlinks}
          currentFile={currentFile}
          currentTags={currentVaultFile?.tags ?? []}
          filter={vaultFilter}
          filterInputRef={vaultSearchInputRef}
          searchMode={vaultSearchMode}
          sort={vaultSort}
          isCollapsed={isSidebarCollapsed}
          isLoading={isVaultFilesLoading}
          isContentSearching={isVaultContentSearching}
          onFilterChange={setVaultFilter}
          onClearFilter={clearVaultSearch}
          onSearchModeChange={setVaultSearchMode}
          onSortChange={setVaultSort}
          onToggleCollapsed={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          onRefresh={() => void refreshVaultFiles()}
          onNewNote={() => void handleNew()}
          onOpenFile={(path) => void openFilePath(path)}
          onOpenSearchResult={(result) => void openVaultSearchResult(result)}
          onOpenInNewInstance={(path) => void handleOpenVaultFileInNewInstance(path)}
          onRenameFile={(file) => void handleRenameVaultFile(file)}
          onDuplicateFile={(file) => void handleDuplicateVaultFile(file)}
          onDeleteFile={(file) => void handleDeleteVaultFile(file)}
          onOpenBacklink={(path) => void openFilePath(path)}
          onTagClick={(tag) => setVaultFilter(`#${tag}`)}
        />

        <div
          className="vault-sidebar-resizer"
          data-disabled={isSidebarCollapsed}
          role="separator"
          aria-label="Resize vault file list"
          aria-orientation="vertical"
          aria-valuemin={220}
          aria-valuemax={520}
          aria-valuenow={Math.round(vaultSidebarWidth)}
          tabIndex={isSidebarCollapsed ? -1 : 0}
          onPointerDown={(event) => {
            if (isSidebarCollapsed) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsDraggingVaultSidebar(true);
            updateVaultSidebarWidthFromPointer(event.clientX);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              setVaultSidebarWidth((width) => Math.max(220, width - 12));
            } else if (event.key === "ArrowRight") {
              setVaultSidebarWidth((width) => Math.min(520, width + 12));
            }
          }}
        />

        <section
          className="workspace"
          ref={workspaceRef}
          style={{
            gridTemplateColumns: isSplitMode
              ? `minmax(360px, calc(${splitPercent}% - 3px)) 6px minmax(280px, calc(${100 - splitPercent}% - 3px))`
              : "minmax(360px, 1fr)",
          }}
        >
          <article className="editor-pane">
            <header className="pane-header">
              <div className="pane-title">
                <span>Editor</span>
                <small>{currentVaultFile?.relativePath ?? currentFile ?? "Untitled"}</small>
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
                  placeholder="Search note"
                  aria-label="Search editor text"
                />
                <button type="button" onClick={() => moveSearch(-1)} disabled={searchMatches.length === 0} aria-label="Previous match">Prev</button>
                <button type="button" onClick={() => moveSearch(1)} disabled={searchMatches.length === 0} aria-label="Next match">Next</button>
                <span aria-live="polite">{searchQuery ? `${hasSearchSelection ? activeSearchIndex + 1 : 0}/${searchMatches.length}` : "0/0"}</span>
              </div>
            </header>
            <MarkdownEditor
              ref={editorRef}
              value={content}
              mode="source"
              themeMode={themeMode}
              onChange={handleContentChange}
            />
          </article>

          {isSplitMode && (
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
                  <small>Markdown, Mermaid, Excalidraw, wiki links</small>
                </header>
                <MarkdownPreview
                  key={previewRevision}
                  ref={previewRef}
                  markdown={content}
                  currentFile={currentFile}
                  themeMode={themeMode}
                  onOpenExcalidraw={(path, scene) => setExcalidrawSession({ path, scene })}
                  onOpenWikiLink={(name) => void handleWikiLink(name)}
                />
              </article>
            </>
          )}
        </section>
      </section>

      <footer className="statusbar">
        <span>{currentFile ? `File: ${currentFile}` : "File: Untitled"}</span>
        <span>{vaultPath ? `Vault: ${vaultPath}` : "Vault: Not set"}</span>
        <span>{modified ? "Modified" : "Saved"}</span>
        <span>{isSplitMode ? "Preview: On" : "Preview: Off"}</span>
        <span>Lines: {stats.lines}</span>
        <span>Chars: {stats.chars}</span>
      </footer>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        query={commandQuery}
        commands={COMMAND_DEFINITIONS}
        disabledCommands={disabledCommands}
        onQueryChange={setCommandQuery}
        onClose={() => setIsCommandPaletteOpen(false)}
        onRun={runCommand}
      />

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
              <label>
                <span>Vault File List Font Size</span>
                <input type="range" min="10" max="18" step="1" value={vaultFileFontSize} onChange={(event) => setVaultFileFontSize(Number(event.target.value))} />
                <output>{vaultFileFontSize}px</output>
              </label>
              <label>
                <span>Vault Sidebar Width</span>
                <input type="range" min="220" max="520" step="10" value={vaultSidebarWidth} onChange={(event) => setVaultSidebarWidth(Number(event.target.value))} />
                <output>{vaultSidebarWidth}px</output>
              </label>
              <button
                type="button"
                onClick={() => {
                  setEditorFontSize(14);
                  setEditorLineHeight(1.55);
                  setPreviewFontSize(16);
                  setPreviewLineHeight(1.65);
                  setUiFontSize(13);
                  setVaultFileFontSize(13);
                  setVaultSidebarWidth(340);
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
