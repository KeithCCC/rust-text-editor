import type { ViewMode } from "./viewMode";

export type SplitOrientation = "vertical" | "horizontal";

const MIN_SPLIT_PERCENT = 25;
const MAX_SPLIT_PERCENT = 75;
const SPLIT_KEY_STEP = 2;

function clampSplitPercent(value: number): number {
  return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value));
}

export function splitOrientationForWidth(width: number): SplitOrientation {
  return width <= 820 ? "horizontal" : "vertical";
}

export function splitPercentFromPointer(input: {
  orientation: SplitOrientation;
  clientX: number;
  clientY: number;
  left: number;
  top: number;
  width: number;
  height: number;
}): number {
  const offset = input.orientation === "vertical"
    ? input.clientX - input.left
    : input.clientY - input.top;
  const length = input.orientation === "vertical" ? input.width : input.height;
  return clampSplitPercent((offset / length) * 100);
}

export function splitPercentFromKey(
  current: number,
  orientation: SplitOrientation,
  key: string,
): number | null {
  const decrementKey = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
  const incrementKey = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
  if (key === decrementKey) return clampSplitPercent(current - SPLIT_KEY_STEP);
  if (key === incrementKey) return clampSplitPercent(current + SPLIT_KEY_STEP);
  return null;
}

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
