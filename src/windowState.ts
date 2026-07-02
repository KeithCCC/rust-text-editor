import {
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { logDebug } from "./debugLog";
import { isTauriRuntime } from "./tauriRuntime";

type SavedWindowState = {
  width: number;
  height: number;
  x: number;
  y: number;
};

const WINDOW_STATE_STORAGE_KEY = "hotaru-window-state";
const MIN_WIDTH = 720;
const MIN_HEIGHT = 520;

function isValidWindowState(value: unknown): value is SavedWindowState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SavedWindowState>;
  return (
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.width) &&
    Number.isFinite(candidate.height) &&
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    candidate.width >= MIN_WIDTH &&
    candidate.height >= MIN_HEIGHT
  );
}

async function readCurrentWindowState(): Promise<SavedWindowState | null> {
  const appWindow = getCurrentWindow();

  if (await appWindow.isMaximized()) {
    return null;
  }

  const [size, position] = await Promise.all([
    appWindow.outerSize(),
    appWindow.outerPosition(),
  ]);

  if (size.width < MIN_WIDTH || size.height < MIN_HEIGHT) {
    return null;
  }

  return {
    width: Math.round(size.width),
    height: Math.round(size.height),
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
}

export async function saveCurrentWindowState() {
  try {
    const state = await readCurrentWindowState();

    if (!state) {
      return;
    }

    window.localStorage.setItem(WINDOW_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    await logDebug(
      "warn",
      "failed to save window state",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
  }
}

export async function installWindowStatePersistence() {
  if (!isTauriRuntime()) {
    return;
  }

  const appWindow = getCurrentWindow();

  try {
    const saved = window.localStorage.getItem(WINDOW_STATE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;

    if (isValidWindowState(parsed)) {
      await appWindow.setSize(new PhysicalSize(parsed.width, parsed.height));
      await appWindow.setPosition(new PhysicalPosition(parsed.x, parsed.y));
    }
  } catch (error) {
    await logDebug(
      "warn",
      "failed to restore window state",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
  } finally {
    await appWindow.show();
  }

  let saveTimer: number | undefined;
  const queueSave = () => {
    if (saveTimer !== undefined) {
      window.clearTimeout(saveTimer);
    }

    saveTimer = window.setTimeout(() => {
      void saveCurrentWindowState();
    }, 250);
  };

  const [unlistenResize, unlistenMove] = await Promise.all([
    appWindow.onResized(queueSave),
    appWindow.onMoved(queueSave),
  ]);

  window.addEventListener("beforeunload", () => {
    unlistenResize();
    unlistenMove();
  });
}
