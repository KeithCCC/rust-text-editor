import { appendDebugLog } from "./tauri";

function serializeError(value: unknown) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function logDebug(level: string, message: string, details?: unknown) {
  appendDebugLog(level, message, details === undefined ? undefined : serializeError(details)).catch(
    () => {
      // Logging must never create a second failure path.
    },
  );
}

export function installGlobalDebugLogging() {
  logDebug("info", "frontend starting", {
    href: window.location.href,
    userAgent: window.navigator.userAgent,
  });

  window.addEventListener("error", (event) => {
    logDebug("error", event.message || "window error", {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: serializeError(event.error),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logDebug("error", "unhandled promise rejection", event.reason);
  });
}
