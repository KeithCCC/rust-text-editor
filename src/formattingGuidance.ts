import type { FormattingUi } from "./formattingUi";
import type { FormatResult } from "./markdownFormatting";

export const TOOLBAR_HINT_STORAGE_KEY = "koharu-toolbar-hint-dismissed";

export function shouldShowToolbarHint(storedValue: string | null): boolean {
  return storedValue !== "true";
}

export function formattingResultMessage(
  result: Pick<FormatResult, "feedback" | "warning">,
  messages: FormattingUi["feedback"],
): string {
  const key = result.warning ?? result.feedback;
  return key ? messages[key] : "";
}
