import { invoke } from "@tauri-apps/api/core";

export type TextFile = {
  path: string;
  content: string;
};

export function readTextFile(path: string) {
  return invoke<TextFile>("read_text_file", { path });
}

export function writeTextFile(path: string, content: string) {
  return invoke<void>("write_text_file", { path, content });
}

export function ensureHotaruVault(selectedDir: string) {
  return invoke<string>("ensure_hotaru_vault", { selectedDir });
}

export function ensureDefaultHotaruVault() {
  return invoke<string>("ensure_default_hotaru_vault");
}

export function createVaultNote(vaultPath: string, content: string) {
  return invoke<TextFile>("create_vault_note", { vaultPath, content });
}

export function getStartupFilePath() {
  return invoke<string | null>("get_startup_file_path");
}

export function readExcalidrawFile(path: string) {
  return invoke<string>("read_excalidraw_file", { path });
}

export function writeExcalidrawFile(path: string, content: string) {
  return invoke<void>("write_excalidraw_file", { path, content });
}

export function appendDebugLog(level: string, message: string, details?: string) {
  return invoke<void>("append_debug_log", { level, message, details });
}

export function getDebugLogPath() {
  return invoke<string>("get_debug_log_path");
}

export function exitApp() {
  return invoke<void>("exit_app");
}

export function resolveRelativePath(baseFile: string, relativePath: string) {
  return invoke<string>("resolve_relative_path", {
    baseFile,
    relativePath,
  });
}
