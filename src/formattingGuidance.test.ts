import { describe, expect, it } from "vitest";
import { getFormattingUi } from "./formattingUi";
import {
  formattingResultMessage,
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
});
