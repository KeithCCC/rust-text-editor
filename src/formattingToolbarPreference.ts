export const FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY = "koharu-formatting-toolbar-visibility";

export function readFormattingToolbarVisibility(
  storage?: Pick<Storage, "getItem">,
): boolean {
  try {
    return (storage ?? window.localStorage).getItem(FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY) !== "hidden";
  } catch {
    return true;
  }
}

export function writeFormattingToolbarVisibility(
  visible: boolean,
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    (storage ?? window.localStorage).setItem(FORMATTING_TOOLBAR_VISIBILITY_STORAGE_KEY, visible ? "visible" : "hidden");
  } catch {
    // A display preference must not interrupt editing when storage is unavailable.
  }
}
