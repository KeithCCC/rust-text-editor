export function canCloseWindow(modified: boolean, confirmClose: () => boolean) {
  return !modified || confirmClose();
}

type CloseRequestedOptions = {
  modified: boolean;
  confirmClose: () => boolean;
  preventDefault: () => void;
  saveWindowState: () => Promise<void>;
};

export async function handleCloseRequested({
  modified,
  confirmClose,
  preventDefault,
  saveWindowState,
}: CloseRequestedOptions) {
  if (!canCloseWindow(modified, confirmClose)) {
    preventDefault();
    return;
  }

  await saveWindowState();
}
