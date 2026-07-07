export function canCloseWindow(modified: boolean, confirmClose: () => boolean) {
  return !modified || confirmClose();
}
