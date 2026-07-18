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
