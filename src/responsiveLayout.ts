import type { ViewMode } from "./viewMode";

type ViewModeShortcutEvent = {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key: string;
  isComposing: boolean;
};

export function shouldCycleViewMode(event: ViewModeShortcutEvent): boolean {
  return !event.isComposing
    && (event.ctrlKey || event.metaKey)
    && event.altKey
    && !event.shiftKey
    && event.key.toLowerCase() === "m";
}

export function resolvePaneVisibility(mode: ViewMode) {
  return {
    editorMounted: true,
    editorVisible: mode !== "preview",
    previewVisible: mode !== "edit",
  };
}
