export function getRelativeMarkdownPath(href: string) {
  const trimmed = href.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
  ) {
    return null;
  }

  const path = trimmed.split(/[?#]/, 1)[0];
  if (!/\.(?:md|markdown)$/i.test(path)) {
    return null;
  }

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
