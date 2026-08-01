import type { FormattingUi } from "./formattingUi";
import type { FormatResult } from "./markdownFormatting";

export const TOOLBAR_HINT_STORAGE_KEY = "koharu-toolbar-hint-dismissed";

export type FormattingAnnouncement = {
  id: number;
  message: string;
};

export const EMPTY_FORMATTING_ANNOUNCEMENT: FormattingAnnouncement = {
  id: 0,
  message: "",
};

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

export function nextFormattingAnnouncement(
  current: FormattingAnnouncement,
  result: Pick<FormatResult, "feedback" | "warning">,
  messages: FormattingUi["feedback"],
): FormattingAnnouncement {
  const message = formattingResultMessage(result, messages);
  if (!message) {
    return current.message ? { ...current, message: "" } : current;
  }
  return { id: current.id + 1, message };
}
