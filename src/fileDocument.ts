export type FileDocument = {
  content: string;
  path: string | null;
  modified: boolean;
};

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
  return `${modified ? "*" : ""}${fileNameFromPath(path)} - Koharu`;
}

export function defaultSaveAsPath(path: string | null) {
  return path ?? "Untitled.md";
}
