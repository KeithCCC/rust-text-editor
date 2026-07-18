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

function contentFingerprint(elements: unknown, files: unknown) {
  return JSON.stringify(normalizeContent({
    elements: elements ?? [],
    files: files ?? {},
  }));
}

export class ExcalidrawContentBaseline {
  private fingerprint: string;

  constructor(elements: unknown, files: unknown) {
    this.fingerprint = contentFingerprint(elements, files);
  }

  isDirty(elements: unknown, files: unknown) {
    return this.fingerprint !== contentFingerprint(elements, files);
  }

  reset(elements: unknown, files: unknown) {
    this.fingerprint = contentFingerprint(elements, files);
  }
}

type ExcalidrawContentSnapshot = {
  elements: unknown;
  files: unknown;
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
  await write();
  baseline.reset(persistedElements, persistedFiles);

  const current = getCurrent();
  const dirty = baseline.isDirty(current.elements, current.files);
  onDirtyChange(dirty);
  return !dirty;
}
