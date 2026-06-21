import { invoke } from "@tauri-apps/api/core";

export type TextFile = {
  path: string;
  content: string;
};

export type FileProperties = {
  path: string;
  size: number;
  createdMs: number | null;
  modifiedMs: number | null;
};

export type VaultFile = {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  createdMs: number | null;
  modifiedMs: number | null;
  isDraft: boolean;
  tags: string[];
};

export type Backlink = {
  path: string;
  relativePath: string;
  name: string;
  matches: string[];
};

export type VaultSearchMatch = {
  path: string;
  relativePath: string;
  name: string;
  lineNumber: number;
  lineText: string;
  lineMatchStart: number;
  lineMatchEnd: number;
  matchStart: number;
  matchEnd: number;
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

export function createNamedVaultNote(vaultPath: string, relativePath: string, content: string) {
  return invoke<TextFile>("create_named_vault_note", { vaultPath, relativePath, content });
}

export function getFileProperties(path: string) {
  return invoke<FileProperties>("get_file_properties", { path });
}

export function listVaultFiles(vaultPath: string) {
  return invoke<VaultFile[]>("list_vault_files", { vaultPath });
}

export function renameVaultFile(vaultPath: string, path: string, newRelativePath: string) {
  return invoke<TextFile>("rename_vault_file", { vaultPath, path, newRelativePath });
}

export function deleteVaultFile(vaultPath: string, path: string) {
  return invoke<void>("delete_vault_file", { vaultPath, path });
}

export function duplicateVaultFile(vaultPath: string, path: string) {
  return invoke<TextFile>("duplicate_vault_file", { vaultPath, path });
}

export function getVaultBacklinks(vaultPath: string, currentPath: string) {
  return invoke<Backlink[]>("get_vault_backlinks", { vaultPath, currentPath });
}

export function searchVaultText(vaultPath: string, query: string, limit?: number) {
  return invoke<VaultSearchMatch[]>("search_vault_text", { vaultPath, query, limit });
}

export function openFileInNewInstance(path: string) {
  return invoke<void>("open_file_in_new_instance", { path });
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
