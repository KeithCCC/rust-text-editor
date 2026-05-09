export type ExcalidrawScene = {
  type?: string;
  version?: number;
  source?: string;
  elements?: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
};

export type EditorError = {
  title: string;
  message: string;
};
