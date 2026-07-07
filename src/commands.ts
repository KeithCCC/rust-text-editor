export type CommandId =
  | "file.new"
  | "file.open"
  | "file.save"
  | "file.saveAs"
  | "file.exportHtml"
  | "view.cycleEditorMode"
  | "view.togglePreview"
  | "view.commandPalette"
  | "theme.system"
  | "theme.light"
  | "theme.dark"
  | "language.en"
  | "language.ja"
  | "search.note"
  | "format.bold"
  | "format.italic"
  | "format.link"
  | "format.json";

export type CommandDefinition = {
  id: CommandId;
  label: string;
  shortcut?: string;
};

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  { id: "file.new", label: "New", shortcut: "Ctrl+N" },
  { id: "file.open", label: "Open File", shortcut: "Ctrl+O" },
  { id: "file.save", label: "Save", shortcut: "Ctrl+S" },
  { id: "file.saveAs", label: "Save As" },
  { id: "file.exportHtml", label: "Export as HTML" },
  { id: "view.cycleEditorMode", label: "Toggle Preview Pane", shortcut: "Ctrl+Shift+V" },
  { id: "view.togglePreview", label: "Toggle Preview Pane" },
  { id: "view.commandPalette", label: "Command Palette", shortcut: "Ctrl+K" },
  { id: "theme.system", label: "Use System Theme" },
  { id: "theme.light", label: "Use Light Theme" },
  { id: "theme.dark", label: "Use Dark Theme" },
  { id: "language.en", label: "Use English UI" },
  { id: "language.ja", label: "Use Japanese UI" },
  { id: "search.note", label: "Find", shortcut: "Ctrl+F" },
  { id: "format.bold", label: "Bold", shortcut: "Ctrl+B" },
  { id: "format.italic", label: "Italic", shortcut: "Ctrl+I" },
  { id: "format.link", label: "Insert Link" },
  { id: "format.json", label: "Format JSON" },
];

export function isPrimaryShortcut(event: KeyboardEvent, key: string) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === key.toLowerCase();
}

export function formatShortcut(shortcut?: string) {
  return shortcut?.replace("Ctrl", navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl") ?? "";
}
