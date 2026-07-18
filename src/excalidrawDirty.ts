function normalizeContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeContent);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((normalized, key) => {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) normalized[key] = normalizeContent(entry);
      return normalized;
    }, {});
}

const PERSISTABLE_APP_STATE_DEFAULTS = {
  viewBackgroundColor: "#ffffff",
  gridModeEnabled: false,
  gridSize: 20,
  gridStep: 5,
} as const;

export function projectPersistableExcalidrawAppState(appState: unknown) {
  const source = appState && typeof appState === "object"
    ? appState as Record<string, unknown>
    : {};
  return Object.keys(PERSISTABLE_APP_STATE_DEFAULTS)
    .reduce<Record<string, unknown>>((projected, key) => {
      projected[key] = source[key] ?? PERSISTABLE_APP_STATE_DEFAULTS[
        key as keyof typeof PERSISTABLE_APP_STATE_DEFAULTS
      ];
      return projected;
    }, {});
}

function contentFingerprint(elements: unknown, files: unknown, appState: unknown) {
  return JSON.stringify(normalizeContent({
    elements: elements ?? [],
    files: files ?? {},
    appState: projectPersistableExcalidrawAppState(appState),
  }));
}

export class ExcalidrawContentBaseline {
  private fingerprint: string;

  constructor(elements: unknown, files: unknown, appState?: unknown) {
    this.fingerprint = contentFingerprint(elements, files, appState);
  }

  isDirty(elements: unknown, files: unknown, appState?: unknown) {
    return this.fingerprint !== contentFingerprint(elements, files, appState);
  }

  reset(elements: unknown, files: unknown, appState?: unknown) {
    this.fingerprint = contentFingerprint(elements, files, appState);
  }
}

type ExcalidrawContentSnapshot = {
  elements: unknown;
  files: unknown;
  appState?: unknown;
};

type PersistExcalidrawSnapshotOptions = {
  baseline: ExcalidrawContentBaseline;
  snapshot: ExcalidrawContentSnapshot;
  write: () => Promise<void>;
  getCurrent: () => ExcalidrawContentSnapshot;
  onDirtyChange: (dirty: boolean) => void;
};

export async function persistExcalidrawSnapshot({
  baseline,
  snapshot,
  write,
  getCurrent,
  onDirtyChange,
}: PersistExcalidrawSnapshotOptions) {
  const persistedElements = normalizeContent(snapshot.elements ?? []);
  const persistedFiles = normalizeContent(snapshot.files ?? {});
  const persistedAppState = projectPersistableExcalidrawAppState(snapshot.appState);
  await write();
  baseline.reset(persistedElements, persistedFiles, persistedAppState);

  const current = getCurrent();
  const dirty = baseline.isDirty(current.elements, current.files, current.appState);
  onDirtyChange(dirty);
  return !dirty;
}
