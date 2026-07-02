type TauriWindow = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

export function isTauriRuntime() {
  const tauriWindow = window as TauriWindow;
  return tauriWindow.__TAURI__ !== undefined || tauriWindow.__TAURI_INTERNALS__ !== undefined;
}
