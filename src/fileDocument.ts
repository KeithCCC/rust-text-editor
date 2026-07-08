export type FileDocument = {
  content: string;
  path: string | null;
  modified: boolean;
};

export const APP_DISPLAY_NAME = "Koharu markdown editor";

export function createUntitledDocument(): FileDocument {
  return {
    content: "",
    path: null,
    modified: false,
  };
}

export function fileNameFromPath(path: string | null) {
  if (!path) {
    return "Untitled";
  }
  return path.replace(/\\/g, "/").split("/").pop() || "Untitled";
}

export function formatDocumentTitle(path: string | null, modified: boolean) {
  return `${modified ? "*" : ""}${fileNameFromPath(path)} - ${APP_DISPLAY_NAME}`;
}

export function defaultSaveAsPath(path: string | null) {
  return path ?? "Untitled.md";
}
