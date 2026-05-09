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

export function resolveRelativePath(baseFile: string, relativePath: string) {
  return invoke<string>("resolve_relative_path", {
    baseFile,
    relativePath,
  });
}
