export type CommandId =
  | "file.new"
  | "file.open"
  | "file.save"
  | "file.saveAs"
  | "file.exportHtml"
  | "file.rename"
  | "file.delete"
  | "file.duplicate"
  | "view.toggleSidebar"
  | "view.cycleEditorMode"
  | "view.togglePreview"
  | "view.commandPalette"
  | "search.note"
  | "search.vault"
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
  { id: "file.new", label: "New Vault Note", shortcut: "Ctrl+N" },
  { id: "file.open", label: "Open File", shortcut: "Ctrl+O" },
  { id: "file.save", label: "Save", shortcut: "Ctrl+S" },
  { id: "file.saveAs", label: "Save As" },
  { id: "file.exportHtml", label: "Export as HTML" },
  { id: "file.rename", label: "Rename Current Note" },
  { id: "file.delete", label: "Delete Current Note" },
  { id: "file.duplicate", label: "Duplicate Current Note" },
  { id: "view.toggleSidebar", label: "Toggle Vault Sidebar", shortcut: "Ctrl+\\" },
  { id: "view.cycleEditorMode", label: "Toggle Preview Pane", shortcut: "Ctrl+Shift+V" },
  { id: "view.togglePreview", label: "Toggle Preview Pane" },
  { id: "view.commandPalette", label: "Command Palette", shortcut: "Ctrl+K" },
  { id: "search.note", label: "Find in Note", shortcut: "Ctrl+F" },
  { id: "search.vault", label: "Find in Vault", shortcut: "Ctrl+Shift+F" },
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
