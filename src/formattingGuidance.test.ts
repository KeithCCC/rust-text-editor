import { describe, expect, it } from "vitest";
import { getFormattingUi } from "./formattingUi";
import {
  formattingResultMessage,
  nextFormattingAnnouncement,
  shouldShowToolbarHint,
  TOOLBAR_HINT_STORAGE_KEY,
} from "./formattingGuidance";

describe("formatting guidance", () => {
  it("shows the toolbar hint until the local dismissal flag is true", () => {
    expect(TOOLBAR_HINT_STORAGE_KEY).toBe("koharu-toolbar-hint-dismissed");
    expect(shouldShowToolbarHint(null)).toBe(true);
    expect(shouldShowToolbarHint("false")).toBe(true);
    expect(shouldShowToolbarHint("true")).toBe(false);
  });

  it("maps formatting feedback and warnings to the active language", () => {
    const english = getFormattingUi("en").feedback;
    const japanese = getFormattingUi("ja").feedback;

    expect(formattingResultMessage({ feedback: "tableInserted" }, english))
      .toBe("Table inserted. Edit the first column heading.");
    expect(formattingResultMessage({ warning: "multilineInlineCode" }, japanese))
      .toBe("文中コードは複数行にできません。コードブロックを使用してください。");
    expect(formattingResultMessage({}, english)).toBe("");
  });

  it("gives every repeated feedback or warning a fresh announcement id", () => {
    const messages = getFormattingUi("en").feedback;
    let announcement = { id: 0, message: "" };

    for (const result of [
      { feedback: "tableInserted" as const },
      { feedback: "tableInserted" as const },
      { feedback: "codeBlockInserted" as const },
      { feedback: "codeBlockInserted" as const },
      { feedback: "mermaidInserted" as const },
      { feedback: "mermaidInserted" as const },
      { warning: "multilineInlineCode" as const },
      { warning: "multilineInlineCode" as const },
    ]) {
      const previousId = announcement.id;
      announcement = nextFormattingAnnouncement(announcement, result, messages);
      expect(announcement.id).toBe(previousId + 1);
      expect(announcement.message).not.toBe("");
    }
  });
});
