export type RecentFile = {
  path: string;
  lastAccessedAt: number;
};

function normalizedPath(path: string) {
  return path.replace(/\//g, "\\").toLocaleLowerCase();
}

export function updateRecentFiles(history: RecentFile[], path: string, now = Date.now()) {
  const target = normalizedPath(path);
  return [
    { path, lastAccessedAt: now },
    ...history.filter((entry) => normalizedPath(entry.path) !== target),
  ].slice(0, 10);
}

export function removeRecentFile(history: RecentFile[], path: string) {
  const target = normalizedPath(path);
  return history.filter((entry) => normalizedPath(entry.path) !== target);
}

export function parseRecentFiles(value: string | null): RecentFile[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const entries = parsed.filter((entry): entry is RecentFile => (
      typeof entry === "object"
      && entry !== null
      && typeof (entry as RecentFile).path === "string"
      && typeof (entry as RecentFile).lastAccessedAt === "number"
    ));
    return entries.length === parsed.length ? entries.slice(0, 10) : [];
  } catch {
    return [];
  }
}
