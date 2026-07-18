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
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { BUILD_INFO } from "./buildInfo";
import { formatBuildLabel } from "./buildLabel";
import { isPrimaryShortcut } from "./keyboardShortcuts";
import {
  DocumentActionGate,
  LatestValue,
  installNativeCloseListener,
  installNativeDragDropListener,
  resolveStartupRecoveryChoice,
  runCloseRequestSafely,
  runExclusiveDocumentAction,
  runSaveOperationSafely,
} from "./appSafety";
import { HelpDialog } from "./components/HelpDialog";
import { DecisionDialog } from "./components/DecisionDialog";
import { MarkdownEditor, type EditorMode, type MarkdownEditorHandle } from "./components/MarkdownEditor";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { MenuCheckboxItem, MenuRadioItem } from "./components/MenuRadioItem";
import { logDebug } from "./debugLog";
import { runDocumentTransition, type UnsavedDecision } from "./documentLifecycle";
import { getDocumentSafetyText } from "./documentSafetyText";
import { buildStandaloneHtml, markdownToHtml } from "./exportHtml";
import { createUntitledDocument, defaultSaveAsPath, fileNameFromPath, formatDocumentTitle } from "./fileDocument";
import { shouldDismissMenuForPointerTarget } from "./menuBehavior";
import { RecoveryDraftQueue, type RecoveryDraft } from "./recoveryDraftQueue";
import { isTauriRuntime } from "./tauriRuntime";
import {
  deleteRecoveryDraft,
  exitApp,
  getFileProperties,
  getStartupFilePath,
  readExcalidrawFile,
  readRecoveryDraft,
  readTextFile,
  resolveRelativePath,
  writeRecoveryDraft,
  writeTextFile,
} from "./tauri";
import type { FileProperties } from "./tauri";
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
type AppLanguage = "en" | "ja";
type MenuId = "file" | "view" | "settings" | "search" | "format" | "help";

const THEME_STORAGE_KEY = "koharu-theme";
const LEGACY_THEME_STORAGE_KEY = "hotaru-theme";
const LANGUAGE_STORAGE_KEY = "koharu-language";
const SPLIT_STORAGE_KEY = "koharu-split";
const LEGACY_SPLIT_STORAGE_KEY = "hotaru-split";
const EDITOR_MODE_STORAGE_KEY = "koharu-editor-mode";
const EDITOR_FONT_SIZE_STORAGE_KEY = "koharu-editor-font-size";
const EDITOR_LINE_HEIGHT_STORAGE_KEY = "koharu-editor-line-height";
const PREVIEW_FONT_SIZE_STORAGE_KEY = "koharu-preview-font-size";
const PREVIEW_LINE_HEIGHT_STORAGE_KEY = "koharu-preview-line-height";
const UI_FONT_SIZE_STORAGE_KEY = "koharu-ui-font-size";
const PREVIEW_UPDATE_DELAY_MS = 350;
const LARGE_DOCUMENT_PREVIEW_UPDATE_DELAY_MS = 700;
const LARGE_DOCUMENT_CHAR_THRESHOLD = 120_000;

const UI_TEXT = {
  en: {
    help: "Help",
    howToUseKoharu: "How to use Koharu",
    file: "File",
    view: "View",
    settings: "Settings",
    search: "Search",
    format: "Format",
    new: "New",
    open: "Open...",
    save: "Save",
    saveAs: "Save As...",
    exportHtml: "Export as HTML...",
    fileProperties: "File Properties...",
    exit: "Exit",
    systemTheme: "System Theme",
    lightTheme: "Light Theme",
    darkTheme: "Dark Theme",
    englishUi: "English UI",
    japaneseUi: "Japanese UI",
    previewPane: "Preview Pane",
    resetSplit: "Reset Split",
    appearance: "Appearance...",
    find: "Find",
    bold: "Bold",
    italic: "Italic",
    insertLink: "Insert Link",
    formatJson: "Format JSON",
    editor: "Editor",
    preview: "Preview",
    untitled: "Untitled",
    updating: "Updating...",
    markdownPreview: "Markdown preview",
    fileStatus: "File:",
    saved: "Saved",
    unsaved: "Unsaved",
    previewOn: "Preview: On",
    previewOff: "Preview: Off",
    lines: "Lines:",
    chars: "Chars:",
    showPreview: "Show Preview",
    hidePreview: "Hide Preview",
    dropToOpen: "Drop to open",
    dropDescription: "Release one text file here.",
    findText: "Find text",
    noSearch: "No search",
    previous: "Previous",
    next: "Next",
    clear: "Clear",
    close: "Close",
    dismiss: "Dismiss",
    unsavedDiscard: "The current file has unsaved changes. Discard them?",
    unsavedExit: "The current file has unsaved changes. Exit anyway?",
    openFailed: "Open failed",
    saveFailed: "Save failed",
    exportFailed: "Export failed",
    filePropertiesUnavailable: "File properties unavailable",
    saveBeforeProperties: "Save the file before viewing file properties.",
    saveBeforeOpeningLink: "Save this document before opening a relative Markdown link.",
    filePropertiesFailed: "File properties failed",
    jsonFormatFailed: "JSON format failed",
    linkOpenFailed: "Link open failed",
    reloadFailed: "Reload failed",
    startupOpenFailed: "Startup open failed",
    excalidrawSaveFailed: "Excalidraw save failed",
    loadingExcalidraw: "Loading Excalidraw...",
    appearanceTitle: "Appearance",
    appearanceDescription: "Editor, preview, and interface text settings",
    editorFontSize: "Editor Font Size",
    editorLineHeight: "Editor Line Height",
    previewFontSize: "Preview Font Size",
    previewLineHeight: "Preview Line Height",
    interfaceFontSize: "Interface Font Size",
    resetAppearance: "Reset Appearance",
    path: "Path",
    created: "Created",
    modified: "Modified",
    size: "Size",
    unavailable: "Unavailable",
    bytes: "bytes",
  },
  ja: {
    help: "ヘルプ",
    howToUseKoharu: "Koharuの使い方",
    file: "ファイル",
    view: "表示",
    settings: "設定",
    search: "検索",
    format: "書式",
    new: "新規",
    open: "開く...",
    save: "保存",
    saveAs: "名前を付けて保存...",
    exportHtml: "HTMLとしてエクスポート...",
    fileProperties: "ファイル情報...",
    exit: "終了",
    systemTheme: "システムテーマ",
    lightTheme: "ライトテーマ",
    darkTheme: "ダークテーマ",
    englishUi: "英語UI",
    japaneseUi: "日本語UI",
    previewPane: "プレビュー",
    resetSplit: "分割をリセット",
    appearance: "外観...",
    find: "検索",
    bold: "太字",
    italic: "斜体",
    insertLink: "リンクを挿入",
    formatJson: "JSON整形",
    editor: "エディタ",
    preview: "プレビュー",
    untitled: "無題",
    updating: "更新中...",
    markdownPreview: "Markdownプレビュー",
    fileStatus: "ファイル:",
    saved: "保存済み",
    unsaved: "未保存",
    previewOn: "プレビュー: オン",
    previewOff: "プレビュー: オフ",
    lines: "行:",
    chars: "文字:",
    showPreview: "プレビューを表示",
    hidePreview: "プレビューを隠す",
    dropToOpen: "ドロップして開く",
    dropDescription: "テキストファイルを1つここにドロップしてください。",
    findText: "検索語",
    noSearch: "検索なし",
    previous: "前へ",
    next: "次へ",
    clear: "クリア",
    close: "閉じる",
    dismiss: "閉じる",
    unsavedDiscard: "現在のファイルには未保存の変更があります。破棄しますか?",
    unsavedExit: "現在のファイルには未保存の変更があります。終了しますか?",
    openFailed: "開くことに失敗しました",
    saveFailed: "保存に失敗しました",
    exportFailed: "エクスポートに失敗しました",
    filePropertiesUnavailable: "ファイル情報を表示できません",
    saveBeforeProperties: "ファイル情報を見る前に保存してください。",
    saveBeforeOpeningLink: "相対Markdownリンクを開く前に、この文書を保存してください。",
    filePropertiesFailed: "ファイル情報の取得に失敗しました",
    jsonFormatFailed: "JSON整形に失敗しました",
    linkOpenFailed: "リンクを開けませんでした",
    reloadFailed: "再読み込みに失敗しました",
    startupOpenFailed: "起動時のファイル読み込みに失敗しました",
    excalidrawSaveFailed: "Excalidrawの保存に失敗しました",
    loadingExcalidraw: "Excalidrawを読み込み中...",
    appearanceTitle: "外観",
    appearanceDescription: "エディタ、プレビュー、UI文字の設定",
    editorFontSize: "エディタ文字サイズ",
    editorLineHeight: "エディタ行間",
    previewFontSize: "プレビュー文字サイズ",
    previewLineHeight: "プレビュー行間",
    interfaceFontSize: "UI文字サイズ",
    resetAppearance: "外観をリセット",
    path: "パス",
    created: "作成日時",
    modified: "更新日時",
    size: "サイズ",
    unavailable: "利用不可",
    bytes: "バイト",
  },
} as const;

function readStoredValue(key: string, legacyKey?: string) {
  return window.localStorage.getItem(key) ?? (legacyKey ? window.localStorage.getItem(legacyKey) : null);
}

function readStoredNumber(key: string, fallback: number, min: number, max: number) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function getDocumentStats(markdown: string) {
  if (markdown.length === 0) {
    return { lines: 0, chars: 0 };
  }

  let lines = 1;
  for (let index = 0; index < markdown.length; index += 1) {
    const char = markdown[index];
    if (char === "\n") {
      lines += 1;
    } else if (char === "\r" && markdown[index + 1] !== "\n") {
      lines += 1;
    }
  }

  return { lines, chars: markdown.length };
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

function normalizeSelectedPath(selection: string | string[] | null) {
  if (Array.isArray(selection)) {
    return selection[0] ?? null;
  }
  return selection;
}

function cycleEditorMode(mode: EditorMode): EditorMode {
  return mode === "split" ? "source" : "split";
}

export default function App() {
  const initialDocument = useMemo(() => createUntitledDocument(), []);
  const [content, setContent] = useState(initialDocument.content);
  const [currentFile, setCurrentFile] = useState<string | null>(initialDocument.path);
  const [modified, setModified] = useState(initialDocument.modified);
  const [error, setError] = useState<EditorError | null>(null);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [fileProperties, setFileProperties] = useState<FileProperties | null>(null);
  const [isAppearanceSettingsOpen, setIsAppearanceSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState(initialDocument.content);
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const [previewRefreshToken, setPreviewRefreshToken] = useState(0);
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    const saved = window.localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
    return saved === "source" || saved === "split" ? saved : "source";
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = readStoredValue(THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "ja" ? "ja" : "en";
  });
  const [editorFontSize, setEditorFontSize] = useState(() => readStoredNumber(EDITOR_FONT_SIZE_STORAGE_KEY, 14, 10, 28));
  const [editorLineHeight, setEditorLineHeight] = useState(() => readStoredNumber(EDITOR_LINE_HEIGHT_STORAGE_KEY, 1.55, 1.1, 2.4));
  const [previewFontSize, setPreviewFontSize] = useState(() => readStoredNumber(PREVIEW_FONT_SIZE_STORAGE_KEY, 16, 10, 30));
  const [previewLineHeight, setPreviewLineHeight] = useState(() => readStoredNumber(PREVIEW_LINE_HEIGHT_STORAGE_KEY, 1.65, 1.1, 2.4));
  const [uiFontSize, setUiFontSize] = useState(() => readStoredNumber(UI_FONT_SIZE_STORAGE_KEY, 13, 10, 18));
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = Number(readStoredValue(SPLIT_STORAGE_KEY, LEGACY_SPLIT_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= 25 && saved <= 75 ? saved : 58;
  });
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNoteSearchVisible, setIsNoteSearchVisible] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [hasSearchSelection, setHasSearchSelection] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [excalidrawSession, setExcalidrawSession] = useState<ExcalidrawSession | null>(null);
  const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState(false);
  const [startupRecoveryDraft, setStartupRecoveryDraft] = useState<RecoveryDraft | null>(null);
  const [pendingStartupPath, setPendingStartupPath] = useState<string | null>(null);
  const [resumeStartupPathAfterRecovery, setResumeStartupPathAfterRecovery] = useState(false);
  const [isStartupResolutionPending, setIsStartupResolutionPending] = useState(isTauriRuntime);
  const [isDocumentTransitionPending, setIsDocumentTransitionPending] = useState(false);
  const [isDirectSavePending, setIsDirectSavePending] = useState(false);
  const [isRelativeLinkPreflightPending, setIsRelativeLinkPreflightPending] = useState(false);
  const menubarRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const syncScrollFrameRef = useRef<number | null>(null);
  const unsavedPromptRef = useRef<{
    promise: Promise<UnsavedDecision>;
    resolve: (decision: UnsavedDecision) => void;
  } | null>(null);
  const transitionInProgressRef = useRef(false);
  const lastRecoveryWriteMsRef = useRef(0);
  const startupLoadedRef = useRef(false);
  const recoveryQueueRef = useRef(
    new RecoveryDraftQueue(writeRecoveryDraft, deleteRecoveryDraft),
  );
  const actionGateRef = useRef(
    new DocumentActionGate(isTauriRuntime() ? ["startup"] : []),
  );
  const latestDocumentRef = useRef(new LatestValue({ content, currentFile, modified }));
  const latestCloseRequestRef = useRef<() => Promise<unknown>>(async () => false);
  const closeErrorReporterRef = useRef<(error: unknown) => void>(() => undefined);
  const latestDroppedPathOpenRef = useRef<(path: string) => Promise<unknown>>(async () => false);
  const dragDropErrorReporterRef = useRef<(error: unknown) => void>(() => undefined);
  const startupRecoveryDecisionInProgressRef = useRef(false);

  const isNativeRuntime = isTauriRuntime();
  const isSplitMode = editorMode === "split";
  const text = UI_TEXT[appLanguage];
  const safetyText = getDocumentSafetyText(appLanguage, fileNameFromPath(currentFile));
  const isDocumentSafetyActive = isStartupResolutionPending
    || isDocumentTransitionPending
    || isDirectSavePending
    || isRelativeLinkPreflightPending
    || isUnsavedPromptOpen;
  latestDocumentRef.current.set({ content, currentFile, modified });
  const appStyle = useMemo(() => ({
    "--editor-font-size": `${editorFontSize}px`,
    "--editor-line-height": String(editorLineHeight),
    "--preview-font-size": `${previewFontSize}px`,
    "--preview-line-height": String(previewLineHeight),
    "--ui-font-size": `${uiFontSize}px`,
  }) as CSSProperties, [editorFontSize, editorLineHeight, previewFontSize, previewLineHeight, uiFontSize]);
  const stats = useMemo(() => getDocumentStats(content), [content]);
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
    void logDebug("error", title, message);
  }, []);

  const requestUnsavedDecision = useCallback(() => {
    if (unsavedPromptRef.current) {
      return unsavedPromptRef.current.promise;
    }

    let resolve!: (decision: UnsavedDecision) => void;
    const promise = new Promise<UnsavedDecision>((next) => { resolve = next; });
    unsavedPromptRef.current = { promise, resolve };
    setIsUnsavedPromptOpen(true);
    return promise;
  }, []);

  const resolveUnsavedDecision = useCallback((decision: UnsavedDecision) => {
    const prompt = unsavedPromptRef.current;
    if (!prompt) return;
    unsavedPromptRef.current = null;
    setIsUnsavedPromptOpen(false);
    prompt.resolve(decision);
  }, []);

  const clearRecoverySafely = useCallback(async (abortTransitionOnFailure = false) => {
    try {
      await recoveryQueueRef.current.clear();
      lastRecoveryWriteMsRef.current = 0;
    } catch (recoveryError) {
      showError(
        safetyText.recoveryFailed,
        recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
      );
      if (abortTransitionOnFailure) {
        recoveryQueueRef.current.resume();
        throw recoveryError;
      }
    }
  }, [safetyText.recoveryFailed, showError]);

  const loadDocument = useCallback((path: string, nextContent: string) => {
    latestDocumentRef.current.set({ content: nextContent, currentFile: path, modified: false });
    setContent(nextContent);
    setPreviewContent(nextContent);
    setCurrentFile(path);
    setModified(false);
    setSearchQuery("");
    setHasSearchSelection(false);
  }, []);

  const resetDocument = useCallback(() => {
    const next = createUntitledDocument();
    latestDocumentRef.current.set({ content: next.content, currentFile: next.path, modified: next.modified });
    setContent(next.content);
    setPreviewContent(next.content);
    setCurrentFile(next.path);
    setModified(next.modified);
    setSearchQuery("");
    setHasSearchSelection(false);
    setFileProperties(null);
  }, []);

  const openFilePath = useCallback(async (path: string) => {
    try {
      const file = await readTextFile(path);
      loadDocument(file.path, file.content);
    } catch (openError) {
      showError(text.openFailed, openError instanceof Error ? openError.message : String(openError));
    }
  }, [loadDocument, showError, text.openFailed]);

  const reportSaveError = useCallback((saveError: unknown) => {
    showError(
      text.saveFailed,
      saveError instanceof Error ? saveError.message : String(saveError),
    );
  }, [showError, text.saveFailed]);

  const handleSaveAs = useCallback(() => runSaveOperationSafely(async () => {
    const documentBeforePicker = latestDocumentRef.current.get();
    const selected = await save({
      defaultPath: defaultSaveAsPath(documentBeforePicker.currentFile),
      filters: [
        { name: "Markdown", extensions: ["md", "markdown"] },
        { name: "Text files", extensions: ["txt"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (!selected) return false;

    const latestDocument = latestDocumentRef.current.get();
    await writeTextFile(selected, latestDocument.content);
    latestDocumentRef.current.set({ ...latestDocument, currentFile: selected, modified: false });
    setCurrentFile(selected);
    await clearRecoverySafely();
    setModified(false);
    return true;
  }, reportSaveError), [clearRecoverySafely, reportSaveError]);

  const handleSave = useCallback(async () => {
    const latestDocument = latestDocumentRef.current.get();
    const path = latestDocument.currentFile;
    if (!path) {
      return handleSaveAs();
    }

    return runSaveOperationSafely(async () => {
      await writeTextFile(path, latestDocument.content);
      latestDocumentRef.current.set({ ...latestDocument, modified: false });
      await clearRecoverySafely();
      setModified(false);
      return true;
    }, reportSaveError);
  }, [clearRecoverySafely, handleSaveAs, reportSaveError]);

  const requestDocumentTransition = useCallback(async (proceed: () => Promise<void>) => {
    if (transitionInProgressRef.current) return false;
    transitionInProgressRef.current = true;
    actionGateRef.current.block("transition");
    setIsDocumentTransitionPending(true);
    try {
      return await runDocumentTransition({
        modified: latestDocumentRef.current.get().modified,
        requestDecision: requestUnsavedDecision,
        save: handleSave,
        discardRecovery: () => clearRecoverySafely(true),
        proceed,
      });
    } finally {
      transitionInProgressRef.current = false;
      actionGateRef.current.release("transition");
      setIsDocumentTransitionPending(false);
    }
  }, [clearRecoverySafely, handleSave, requestUnsavedDecision]);

  const openDroppedPath = useCallback(
    (path: string) => requestDocumentTransition(() => openFilePath(path)),
    [openFilePath, requestDocumentTransition],
  );
  const reportDragDropError = useCallback((dragDropError: unknown) => {
    showError(
      text.openFailed,
      dragDropError instanceof Error ? dragDropError.message : String(dragDropError),
    );
  }, [showError, text.openFailed]);
  latestDroppedPathOpenRef.current = openDroppedPath;
  dragDropErrorReporterRef.current = reportDragDropError;

  const handleNew = useCallback(async () => {
    if (actionGateRef.current.isBlocked()) return;
    await requestDocumentTransition(async () => {
      resetDocument();
      requestAnimationFrame(() => editorRef.current?.focus());
    });
  }, [requestDocumentTransition, resetDocument]);

  const handleOpen = useCallback(async () => {
    if (actionGateRef.current.isBlocked()) return;
    const selected = normalizeSelectedPath(await open({
      multiple: false,
      filters: [
        { name: "Text files", extensions: ["txt", "md", "markdown", "json", "csv", "log"] },
        { name: "All files", extensions: ["*"] },
      ],
    }));
    if (selected) {
      await requestDocumentTransition(() => openFilePath(selected));
    }
  }, [openFilePath, requestDocumentTransition]);

  const reportCloseError = useCallback((closeError: unknown) => {
    showError(
      text.exit,
      closeError instanceof Error ? closeError.message : String(closeError),
    );
  }, [showError, text.exit]);

  const requestAppClose = useCallback(() => {
    if (actionGateRef.current.isBlocked()) return Promise.resolve(false);
    return runCloseRequestSafely(
      () => requestDocumentTransition(async () => {
        await saveCurrentWindowState();
        if (isTauriRuntime()) await exitApp();
        else window.close();
      }),
      reportCloseError,
    );
  }, [reportCloseError, requestDocumentTransition]);
  latestCloseRequestRef.current = requestAppClose;
  closeErrorReporterRef.current = reportCloseError;

  const handleSaveAction = useCallback(async () => {
    const result = await runExclusiveDocumentAction(
      actionGateRef.current,
      "direct-save",
      handleSave,
      setIsDirectSavePending,
    );
    return result ?? false;
  }, [handleSave]);

  const handleSaveAsAction = useCallback(async () => {
    const result = await runExclusiveDocumentAction(
      actionGateRef.current,
      "direct-save-as",
      handleSaveAs,
      setIsDirectSavePending,
    );
    return result ?? false;
  }, [handleSaveAs]);

  const handleExit = useCallback(async () => {
    await requestAppClose();
  }, [requestAppClose]);

  const handleExportHtml = useCallback(async () => {
    const selected = await save({
      defaultPath: `${fileNameFromPath(currentFile).replace(/\.[^.]+$/, "") || "Untitled"}.html`,
      filters: [{ name: "HTML", extensions: ["html", "htm"] }],
    });
    if (!selected) {
      return;
    }

    try {
      await writeTextFile(selected, await buildStandaloneHtml({
        title: fileNameFromPath(currentFile),
        bodyHtml: markdownToHtml(content),
      }));
    } catch (exportError) {
      showError(text.exportFailed, exportError instanceof Error ? exportError.message : String(exportError));
    }
  }, [content, currentFile, showError, text.exportFailed]);

  const handleFileProperties = useCallback(async () => {
    if (!currentFile) {
      showError(text.filePropertiesUnavailable, text.saveBeforeProperties);
      return;
    }

    try {
      setFileProperties(await getFileProperties(currentFile));
    } catch (propertiesError) {
      showError(text.filePropertiesFailed, propertiesError instanceof Error ? propertiesError.message : String(propertiesError));
    }
  }, [currentFile, showError, text.filePropertiesFailed, text.filePropertiesUnavailable, text.saveBeforeProperties]);

  const handleContentChange = useCallback((value: string) => {
    if (actionGateRef.current.isBlocked()) return;
    recoveryQueueRef.current.resume();
    latestDocumentRef.current.set({
      ...latestDocumentRef.current.get(),
      content: value,
      modified: true,
    });
    setContent(value);
    setModified(true);
  }, []);

  const moveSearch = useCallback((direction: 1 | -1) => {
    if (searchMatches.length === 0) {
      setHasSearchSelection(false);
      return;
    }

    const nextIndex = hasSearchSelection
      ? (activeSearchIndex + direction + searchMatches.length) % searchMatches.length
      : direction > 0 ? 0 : searchMatches.length - 1;
    const start = searchMatches[nextIndex];
    setActiveSearchIndex(nextIndex);
    setHasSearchSelection(true);
    editorRef.current?.selectRange(start, start + searchQuery.length);
  }, [activeSearchIndex, hasSearchSelection, searchMatches, searchQuery.length]);

  const closeNoteSearch = useCallback(() => {
    setIsNoteSearchVisible(false);
    setSearchQuery("");
    setHasSearchSelection(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  const handleFormatJson = useCallback(() => {
    if (actionGateRef.current.isBlocked()) return;
    try {
      const formatted = JSON.stringify(JSON.parse(content), null, 2);
      recoveryQueueRef.current.resume();
      latestDocumentRef.current.set({
        ...latestDocumentRef.current.get(),
        content: formatted,
        modified: true,
      });
      setContent(formatted);
      setModified(true);
    } catch (formatError) {
      showError(text.jsonFormatFailed, formatError instanceof Error ? formatError.message : String(formatError));
    }
  }, [content, showError, text.jsonFormatFailed]);

  const handleOpenExcalidrawPreview = useCallback((path: string, scene: ExcalidrawScene | null) => {
    setExcalidrawSession({ path, scene });
  }, []);

  const handleOpenRelativeMarkdownLink = useCallback((relativePath: string) => {
    if (actionGateRef.current.isBlocked()) return;
    if (!currentFile) {
      showError(text.linkOpenFailed, text.saveBeforeOpeningLink);
      return;
    }

    void runExclusiveDocumentAction(
      actionGateRef.current,
      "relative-link-preflight",
      async () => {
        try {
          const path = await resolveRelativePath(currentFile, relativePath);
          await requestDocumentTransition(() => openFilePath(path));
        } catch (linkError) {
          showError(
            text.linkOpenFailed,
            linkError instanceof Error ? linkError.message : String(linkError),
          );
        }
      },
      setIsRelativeLinkPreflightPending,
    );
  }, [currentFile, openFilePath, requestDocumentTransition, showError, text.linkOpenFailed, text.saveBeforeOpeningLink]);

  const handleExcalidrawSaved = useCallback(async (path: string) => {
    if (path === currentFile) {
      try {
        const file = await readTextFile(path);
        loadDocument(file.path, file.content);
      } catch (readError) {
        showError(text.reloadFailed, readError instanceof Error ? readError.message : String(readError));
      }
    }
  }, [currentFile, loadDocument, showError, text.reloadFailed]);

  const completeStartupResolution = useCallback(() => {
    actionGateRef.current.release("startup");
    setIsStartupResolutionPending(false);
  }, []);

  const finishStartupRecovery = useCallback(async (recover: boolean) => {
    if (startupRecoveryDecisionInProgressRef.current) return;
    const draft = startupRecoveryDraft;
    if (!draft) return;
    startupRecoveryDecisionInProgressRef.current = true;
    try {
      const resolved = await resolveStartupRecoveryChoice(
        recover,
        () => {
          recoveryQueueRef.current.resume();
          latestDocumentRef.current.set({
            content: draft.content,
            currentFile: draft.documentPath,
            modified: true,
          });
          setContent(draft.content);
          setPreviewContent(draft.content);
          setCurrentFile(draft.documentPath);
          setModified(true);
        },
        () => clearRecoverySafely(true),
        () => setStartupRecoveryDraft(null),
      );
      if (!resolved) return;

      if (pendingStartupPath) {
        if (recover) {
          setResumeStartupPathAfterRecovery(true);
        } else {
          const path = pendingStartupPath;
          setPendingStartupPath(null);
          await requestDocumentTransition(() => openFilePath(path));
          completeStartupResolution();
        }
      } else {
        completeStartupResolution();
      }
    } catch (startupError) {
      showError(
        text.startupOpenFailed,
        startupError instanceof Error ? startupError.message : String(startupError),
      );
      completeStartupResolution();
    } finally {
      startupRecoveryDecisionInProgressRef.current = false;
    }
  }, [clearRecoverySafely, completeStartupResolution, openFilePath, pendingStartupPath, requestDocumentTransition, showError, startupRecoveryDraft, text.startupOpenFailed]);

  const openNoteSearch = useCallback(() => {
    setIsNoteSearchVisible(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const handleBold = useCallback(() => {
    if (actionGateRef.current.isBlocked()) return;
    editorRef.current?.wrapSelection("**", "**", "bold text");
  }, []);

  const handleItalic = useCallback(() => {
    if (actionGateRef.current.isBlocked()) return;
    editorRef.current?.wrapSelection("_", "_", "italic text");
  }, []);

  const handleInsertLink = useCallback(() => {
    if (actionGateRef.current.isBlocked()) return;
    editorRef.current?.wrapSelection("[", "](url)", "link text");
  }, []);

  const runMenuAction = useCallback((action: () => void | Promise<unknown>) => {
    setActiveMenu(null);
    if (actionGateRef.current.isBlocked()) return;
    void action();
  }, []);

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
    document.title = formatDocumentTitle(currentFile, modified);
  }, [currentFile, modified]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, appLanguage);
  }, [appLanguage]);

  useEffect(() => {
    window.localStorage.setItem(EDITOR_MODE_STORAGE_KEY, editorMode);
  }, [editorMode]);

  useEffect(() => {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(splitPercent));
  }, [splitPercent]);

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
    setIsPreviewPending(true);
    const delay = content.length >= LARGE_DOCUMENT_CHAR_THRESHOLD
      ? LARGE_DOCUMENT_PREVIEW_UPDATE_DELAY_MS
      : PREVIEW_UPDATE_DELAY_MS;
    const timer = window.setTimeout(() => {
      setPreviewContent(content);
      setIsPreviewPending(false);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    setActiveSearchIndex(0);
    setHasSearchSelection(false);
  }, [searchQuery]);

  useEffect(() => {
    if (!isTauriRuntime() || !modified) return undefined;
    if (lastRecoveryWriteMsRef.current === 0) {
      lastRecoveryWriteMsRef.current = Date.now();
    }
    const elapsed = Date.now() - lastRecoveryWriteMsRef.current;
    const delay = Math.min(2000, Math.max(0, 30_000 - elapsed));
    const scheduledWrite = recoveryQueueRef.current.scheduleWrite({
      schemaVersion: 1,
      documentPath: currentFile,
      content,
      updatedMs: Date.now(),
    });
    const timer = window.setTimeout(() => {
      void scheduledWrite().then((wrote) => {
        if (wrote) lastRecoveryWriteMsRef.current = Date.now();
      }, (recoveryError) => {
        showError(
          safetyText.recoveryFailed,
          recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        );
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [content, currentFile, modified, safetyText.recoveryFailed, showError]);

  useEffect(() => {
    if (!isTauriRuntime() || startupLoadedRef.current) return;
    startupLoadedRef.current = true;
    const recovery = readRecoveryDraft().catch((recoveryError) => {
      showError(
        safetyText.recoveryFailed,
        recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
      );
      return null;
    });
    void Promise.all([recovery, getStartupFilePath()])
      .then(async ([draft, startupPath]) => {
        setPendingStartupPath(startupPath);
        if (draft) {
          setStartupRecoveryDraft(draft);
          return;
        }
        if (startupPath) {
          await requestDocumentTransition(() => openFilePath(startupPath));
        }
        completeStartupResolution();
      })
      .catch((startupError) => {
        showError(text.startupOpenFailed, startupError instanceof Error ? startupError.message : String(startupError));
        completeStartupResolution();
      });
  }, [completeStartupResolution, openFilePath, requestDocumentTransition, safetyText.recoveryFailed, showError, text.startupOpenFailed]);

  useEffect(() => {
    if (!resumeStartupPathAfterRecovery || !pendingStartupPath) return;
    const path = pendingStartupPath;
    setResumeStartupPathAfterRecovery(false);
    setPendingStartupPath(null);
    void requestDocumentTransition(() => openFilePath(path))
      .catch((startupError) => {
        showError(text.startupOpenFailed, startupError instanceof Error ? startupError.message : String(startupError));
      })
      .finally(completeStartupResolution);
  }, [completeStartupResolution, openFilePath, pendingStartupPath, requestDocumentTransition, resumeStartupPathAfterRecovery, showError, text.startupOpenFailed]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }
    return installNativeCloseListener(
      (listener) => getCurrentWindow().onCloseRequested(listener),
      () => latestCloseRequestRef.current,
      (closeError) => closeErrorReporterRef.current(closeError),
    );
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }
    return installNativeDragDropListener(
      (listener) => getCurrentWebview().onDragDropEvent(listener),
      () => actionGateRef.current.isBlocked(),
      () => latestDroppedPathOpenRef.current,
      setIsFileDragOver,
      (dragDropError) => dragDropErrorReporterRef.current(dragDropError),
    );
  }, []);

  useEffect(() => {
    if (!activeMenu) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (shouldDismissMenuForPointerTarget(menubarRef.current, event.target)) {
        setActiveMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [activeMenu]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (actionGateRef.current.isBlocked()) {
        if (event.ctrlKey || event.metaKey) event.preventDefault();
        return;
      }

      if (isHelpOpen) {
        return;
      }

      if (isPrimaryShortcut(event, "n")) {
        event.preventDefault();
        handleNew();
      } else if (isPrimaryShortcut(event, "o")) {
        event.preventDefault();
        void handleOpen();
      } else if (isPrimaryShortcut(event, "s")) {
        event.preventDefault();
        if (event.shiftKey) {
          void handleSaveAsAction();
        } else {
          void handleSaveAction();
        }
      } else if (isPrimaryShortcut(event, "f")) {
        event.preventDefault();
        openNoteSearch();
      } else if (isPrimaryShortcut(event, "b")) {
        event.preventDefault();
        handleBold();
      } else if (isPrimaryShortcut(event, "i")) {
        event.preventDefault();
        handleItalic();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        setEditorMode((mode) => cycleEditorMode(mode));
      } else if (event.key === "Escape") {
        setActiveMenu(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBold, handleItalic, handleNew, handleOpen, handleSaveAction, handleSaveAsAction, isHelpOpen, openNoteSearch]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingSplit) {
        return;
      }
      updateSplitFromPointer(event.clientX);
    };
    const handlePointerUp = () => setIsDraggingSplit(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingSplit, updateSplitFromPointer]);

  useEffect(() => {
    if (!isSplitMode) {
      return undefined;
    }

    const editor = editorRef.current?.getScrollElement();
    const preview = previewRef.current;
    if (!editor || !preview) {
      return undefined;
    }

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (isSyncingScrollRef.current) {
        return;
      }
      if (syncScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(syncScrollFrameRef.current);
      }
      syncScrollFrameRef.current = window.requestAnimationFrame(() => {
        const maxSource = source.scrollHeight - source.clientHeight;
        const maxTarget = target.scrollHeight - target.clientHeight;
        const ratio = maxSource <= 0 ? 0 : source.scrollTop / maxSource;
        isSyncingScrollRef.current = true;
        target.scrollTop = ratio * Math.max(0, maxTarget);
        window.setTimeout(() => {
          isSyncingScrollRef.current = false;
        }, 0);
      });
    };

    const syncFromEditor = () => syncScroll(editor, preview);
    const syncFromPreview = () => syncScroll(preview, editor);
    editor.addEventListener("scroll", syncFromEditor, { passive: true });
    preview.addEventListener("scroll", syncFromPreview, { passive: true });
    return () => {
      editor.removeEventListener("scroll", syncFromEditor);
      preview.removeEventListener("scroll", syncFromPreview);
    };
  }, [isSplitMode, previewContent]);

  return (
    <main
      className="app-shell"
      data-theme={themeMode}
      aria-busy={isDocumentSafetyActive}
      style={appStyle}
      onDragOver={isNativeRuntime ? undefined : (event) => {
        event.preventDefault();
        setIsFileDragOver(true);
      }}
      onDragLeave={isNativeRuntime ? undefined : () => setIsFileDragOver(false)}
      onDrop={isNativeRuntime ? undefined : (event) => {
        event.preventDefault();
        setIsFileDragOver(false);
        if (actionGateRef.current.isBlocked()) return;
        const file = event.dataTransfer.files.item(0);
        const path = file ? "path" in file ? String(file.path) : "" : "";
        if (path) {
          void requestDocumentTransition(() => openFilePath(path));
        }
      }}
    >
      <header className="app-header">
        <nav className="menubar-shell" aria-label="Application menu" ref={menubarRef}>
          <div className="menu-root" data-open={activeMenu === "file"} onMouseEnter={() => activeMenu && setActiveMenu("file")}>
            <button className="menu-title" aria-expanded={activeMenu === "file"} onClick={() => setActiveMenu((menu) => (menu === "file" ? null : "file"))}>{text.file}</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(handleNew)}>{text.new} <kbd>Ctrl+N</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(handleOpen)}>{text.open} <kbd>Ctrl+O</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(handleSaveAction)}>{text.save} <kbd>Ctrl+S</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(handleSaveAsAction)}>{text.saveAs}</button>
              <button role="menuitem" onClick={() => runMenuAction(handleExportHtml)}>{text.exportHtml}</button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={() => runMenuAction(handleFileProperties)} disabled={!currentFile}>{text.fileProperties}</button>
              <div className="menu-separator" />
              <button role="menuitem" onClick={() => runMenuAction(handleExit)}>{text.exit}</button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "view"} onMouseEnter={() => activeMenu && setActiveMenu("view")}>
            <button className="menu-title" aria-expanded={activeMenu === "view"} onClick={() => setActiveMenu((menu) => (menu === "view" ? null : "view"))}>{text.view}</button>
            <div className="menu-popover" role="menu">
              <MenuRadioItem name="theme" value="system" checked={themeMode === "system"} label={text.systemTheme} onSelect={() => runMenuAction(() => setThemeMode("system"))} />
              <MenuRadioItem name="theme" value="light" checked={themeMode === "light"} label={text.lightTheme} onSelect={() => runMenuAction(() => setThemeMode("light"))} />
              <MenuRadioItem name="theme" value="dark" checked={themeMode === "dark"} label={text.darkTheme} onSelect={() => runMenuAction(() => setThemeMode("dark"))} />
              <div className="menu-separator" />
              <MenuRadioItem name="language" value="en" checked={appLanguage === "en"} label={text.englishUi} onSelect={() => runMenuAction(() => setAppLanguage("en"))} />
              <MenuRadioItem name="language" value="ja" checked={appLanguage === "ja"} label={text.japaneseUi} onSelect={() => runMenuAction(() => setAppLanguage("ja"))} />
              <div className="menu-separator" />
              <MenuCheckboxItem
                checked={isSplitMode}
                label={text.previewPane}
                shortcut="Ctrl+Shift+V"
                onToggle={() => runMenuAction(() => setEditorMode((mode) => cycleEditorMode(mode)))}
              />
              <button role="menuitem" onClick={() => runMenuAction(() => setSplitPercent(58))}>{text.resetSplit}</button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "settings"} onMouseEnter={() => activeMenu && setActiveMenu("settings")}>
            <button className="menu-title" aria-expanded={activeMenu === "settings"} onClick={() => setActiveMenu((menu) => (menu === "settings" ? null : "settings"))}>{text.settings}</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(() => setIsAppearanceSettingsOpen(true))}>{text.appearance}</button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "search"} onMouseEnter={() => activeMenu && setActiveMenu("search")}>
            <button className="menu-title" aria-expanded={activeMenu === "search"} onClick={() => setActiveMenu((menu) => (menu === "search" ? null : "search"))}>{text.search}</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(openNoteSearch)}>{text.find} <kbd>Ctrl+F</kbd></button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "format"} onMouseEnter={() => activeMenu && setActiveMenu("format")}>
            <button className="menu-title" aria-expanded={activeMenu === "format"} onClick={() => setActiveMenu((menu) => (menu === "format" ? null : "format"))}>{text.format}</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(handleBold)}>{text.bold} <kbd>Ctrl+B</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(handleItalic)}>{text.italic} <kbd>Ctrl+I</kbd></button>
              <button role="menuitem" onClick={() => runMenuAction(handleInsertLink)}>{text.insertLink}</button>
              <button role="menuitem" onClick={() => runMenuAction(handleFormatJson)}>{text.formatJson}</button>
            </div>
          </div>

          <div className="menu-root" data-open={activeMenu === "help"} onMouseEnter={() => activeMenu && setActiveMenu("help")}>
            <button className="menu-title" aria-expanded={activeMenu === "help"} onClick={() => setActiveMenu((menu) => (menu === "help" ? null : "help"))}>{text.help}</button>
            <div className="menu-popover" role="menu">
              <button role="menuitem" onClick={() => runMenuAction(() => setIsHelpOpen(true))}>{text.howToUseKoharu}</button>
            </div>
          </div>

          <button
            type="button"
            className="menubar-icon-button preview-pane-toggle-button"
            onClick={() => setEditorMode((mode) => cycleEditorMode(mode))}
            title={`${isSplitMode ? text.hidePreview : text.showPreview} (Ctrl+Shift+V)`}
            aria-label={isSplitMode ? text.hidePreview : text.showPreview}
            aria-pressed={isSplitMode}
          >
            <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <rect x="2.75" y="3.25" width="12.5" height="11.5" rx="1.5" />
              <line x1="9.5" y1="4.75" x2="9.5" y2="13.25" />
              {isSplitMode && <path className="preview-toggle-panel" d="M10.85 4.75h2.9c.55 0 1 .45 1 1v6.5c0 .55-.45 1-1 1h-2.9z" />}
              <circle cx="12.8" cy="9" r="1.45" />
            </svg>
          </button>
        </nav>

      </header>

      {error && (
        <section className="error-banner" role="alert">
          <div>
            <strong>{error.title}</strong>
            <span>{error.message}</span>
          </div>
          <button onClick={() => setError(null)} aria-label={text.dismiss}>{text.dismiss}</button>
        </section>
      )}

      {isFileDragOver && (
        <section className="drop-overlay" aria-live="polite">
          <strong>{text.dropToOpen}</strong>
          <span>{text.dropDescription}</span>
        </section>
      )}

      <section className="app-body">
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
                <span>{text.editor}</span>
                <small>{currentFile ?? text.untitled}</small>
              </div>
              {isNoteSearchVisible && (
                <div className="note-search" role="search" aria-label={text.find}>
                  <label htmlFor="note-search-input">{text.find}</label>
                  <div className="note-search-controls">
                    <input
                      id="note-search-input"
                      ref={searchInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          moveSearch(event.shiftKey ? -1 : 1);
                        } else if (event.key === "Escape") {
                          closeNoteSearch();
                        }
                      }}
                      placeholder={text.findText}
                      aria-label={text.find}
                    />
                    <span aria-live="polite" className="note-search-count">
                      {searchQuery ? `${hasSearchSelection ? activeSearchIndex + 1 : 0} / ${searchMatches.length}` : text.noSearch}
                    </span>
                    <button type="button" onClick={() => moveSearch(-1)} disabled={searchMatches.length === 0} aria-label={text.previous}>{text.previous}</button>
                    <button type="button" onClick={() => moveSearch(1)} disabled={searchMatches.length === 0} aria-label={text.next}>{text.next}</button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setHasSearchSelection(false);
                        searchInputRef.current?.focus();
                      }}
                      disabled={!searchQuery}
                      aria-label={text.clear}
                    >
                      {text.clear}
                    </button>
                    <button type="button" onClick={closeNoteSearch} aria-label={text.close}>{text.close}</button>
                  </div>
                </div>
              )}
            </header>
            <MarkdownEditor
              ref={editorRef}
              value={content}
              mode="source"
              themeMode={themeMode}
              readOnly={isDocumentSafetyActive}
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
                  <span>{text.preview}</span>
                  <small>{isPreviewPending ? text.updating : text.markdownPreview}</small>
                </header>
                <MarkdownPreview
                  key={previewRefreshToken}
                  ref={previewRef}
                  markdown={previewContent}
                  currentFile={currentFile}
                  themeMode={themeMode}
                  onOpenExcalidraw={handleOpenExcalidrawPreview}
                  onOpenRelativeMarkdownLink={handleOpenRelativeMarkdownLink}
                />
              </article>
            </>
          )}
        </section>
      </section>

      <footer className="statusbar">
        <span>{currentFile ? `${text.fileStatus} ${currentFile}` : `${text.fileStatus} ${text.untitled}`}</span>
        <span>{modified ? text.unsaved : text.saved}</span>
        <span>{isSplitMode ? text.previewOn : text.previewOff}</span>
        <span>{text.lines} {stats.lines}</span>
        <span>{text.chars} {stats.chars}</span>
        <span className="statusbar-build">{formatBuildLabel(BUILD_INFO.buildNumber)}</span>
      </footer>

      {fileProperties && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="file-properties-title">
          <div className="file-properties-modal">
            <header className="modal-toolbar">
              <div>
                <strong id="file-properties-title">{text.fileProperties.replace("...", "")}</strong>
                <span>{fileProperties.path}</span>
              </div>
              <button type="button" onClick={() => setFileProperties(null)}>{text.close}</button>
            </header>
            <dl className="file-properties-grid">
              <dt>{text.path}</dt>
              <dd>{fileProperties.path}</dd>
              <dt>{text.created}</dt>
              <dd>{fileProperties.createdMs === null ? text.unavailable : formatFileDate(fileProperties.createdMs)}</dd>
              <dt>{text.modified}</dt>
              <dd>{fileProperties.modifiedMs === null ? text.unavailable : formatFileDate(fileProperties.modifiedMs)}</dd>
              <dt>{text.size}</dt>
              <dd>{fileProperties.size.toLocaleString()} {text.bytes}</dd>
            </dl>
          </div>
        </section>
      )}

      {isHelpOpen && (
        <HelpDialog language={appLanguage} onClose={() => setIsHelpOpen(false)} />
      )}

      {isAppearanceSettingsOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="appearance-settings-title">
          <div className="file-properties-modal">
            <header className="modal-toolbar">
              <div>
                <strong id="appearance-settings-title">{text.appearanceTitle}</strong>
                <span>{text.appearanceDescription}</span>
              </div>
              <button type="button" onClick={() => setIsAppearanceSettingsOpen(false)}>{text.close}</button>
            </header>
            <div className="appearance-settings-body">
              <label>
                <span>{text.editorFontSize}</span>
                <input type="range" min="10" max="28" step="1" value={editorFontSize} onChange={(event) => setEditorFontSize(Number(event.target.value))} />
                <output>{editorFontSize}px</output>
              </label>
              <label>
                <span>{text.editorLineHeight}</span>
                <input type="range" min="1.1" max="2.4" step="0.05" value={editorLineHeight} onChange={(event) => setEditorLineHeight(Number(event.target.value))} />
                <output>{editorLineHeight.toFixed(2)}</output>
              </label>
              <label>
                <span>{text.previewFontSize}</span>
                <input type="range" min="10" max="30" step="1" value={previewFontSize} onChange={(event) => setPreviewFontSize(Number(event.target.value))} />
                <output>{previewFontSize}px</output>
              </label>
              <label>
                <span>{text.previewLineHeight}</span>
                <input type="range" min="1.1" max="2.4" step="0.05" value={previewLineHeight} onChange={(event) => setPreviewLineHeight(Number(event.target.value))} />
                <output>{previewLineHeight.toFixed(2)}</output>
              </label>
              <label>
                <span>{text.interfaceFontSize}</span>
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
                {text.resetAppearance}
              </button>
            </div>
          </div>
        </section>
      )}

      {isUnsavedPromptOpen && (
        <DecisionDialog
          title={safetyText.unsavedTitle}
          message={safetyText.unsavedMessage}
          actions={[
            { id: "save", label: safetyText.save, emphasis: "primary" },
            { id: "discard", label: safetyText.dontSave, emphasis: "danger" },
            { id: "cancel", label: safetyText.cancel },
          ]}
          cancelId="cancel"
          onDecision={(id) => resolveUnsavedDecision(id as UnsavedDecision)}
        />
      )}

      {startupRecoveryDraft && (
        <DecisionDialog
          title={safetyText.recoveryTitle}
          message={safetyText.recoveryMessage}
          actions={[
            { id: "recover", label: safetyText.recover, emphasis: "primary" },
            { id: "discard", label: safetyText.discardRecovery, emphasis: "danger" },
          ]}
          cancelId="recover"
          onDecision={(id) => void finishStartupRecovery(id === "recover")}
        />
      )}

      {excalidrawSession && (
        <Suspense fallback={<div className="modal-backdrop">{text.loadingExcalidraw}</div>}>
          <ExcalidrawEditor
            path={excalidrawSession.path}
            initialScene={excalidrawSession.scene}
            onClose={() => setExcalidrawSession(null)}
            onSaved={() => void handleExcalidrawSaved(excalidrawSession.path)}
            onError={(message) => showError(text.excalidrawSaveFailed, message)}
          />
        </Suspense>
      )}
    </main>
  );
}
