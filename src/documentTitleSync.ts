export type NativeTitleSetter = (title: string) => Promise<void>;
export type TitleErrorReporter = (error: unknown) => void;

export async function synchronizeDocumentTitle(
  title: string,
  setNativeTitle?: NativeTitleSetter,
  reportError: TitleErrorReporter = (error) => console.error("Failed to synchronize native window title", error),
) {
  document.title = title;

  if (!setNativeTitle) {
    return;
  }

  try {
    await setNativeTitle(title);
  } catch (error) {
    reportError(error);
  }
}
