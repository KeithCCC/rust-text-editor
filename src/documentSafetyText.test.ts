import { describe, expect, test } from "vitest";
import { getDocumentSafetyText } from "./documentSafetyText";

describe("document safety copy", () => {
  test("names the English document", () => {
    expect(getDocumentSafetyText("en", "notes.md").unsavedMessage)
      .toBe("notes.md has unsaved changes.");
  });

  test("provides Japanese recovery copy", () => {
    const text = getDocumentSafetyText("ja", "メモ.md");
    expect(text.unsavedTitle).toBe("変更を保存しますか？");
    expect(text.recoveryTitle).toBe("未保存の文書を復元しますか？");
  });
});
