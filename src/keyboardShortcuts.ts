export function isPrimaryShortcut(event: KeyboardEvent, key: string) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === key.toLowerCase();
}
