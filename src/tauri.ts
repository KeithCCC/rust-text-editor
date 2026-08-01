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

export type RecoveryDraft = {
  schemaVersion: 1;
  documentPath: string | null;
  content: string;
  updatedMs: number;
};

export function readTextFile(path: string) {
  return invoke<TextFile>("read_text_file", { path });
}

export function writeTextFile(path: string, content: string) {
  return invoke<void>("write_text_file", { path, content });
}

export function writeBinaryFile(path: string, content: number[]) {
  return invoke<void>("write_binary_file", { path, content });
}

export function readRecoveryDraft() {
  return invoke<RecoveryDraft | null>("read_recovery_draft");
}

export function writeRecoveryDraft(draft: RecoveryDraft) {
  return invoke<void>("write_recovery_draft", { draft });
}

export function deleteRecoveryDraft() {
  return invoke<void>("delete_recovery_draft");
}

export function getFileProperties(path: string) {
  return invoke<FileProperties>("get_file_properties", { path });
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
