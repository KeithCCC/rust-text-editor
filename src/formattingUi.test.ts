import { describe, expect, it } from "vitest";
import { getFormattingUi } from "./formattingUi";

describe("getFormattingUi", () => {
  it("provides native Japanese labels and explanatory tooltips", () => {
    const ui = getFormattingUi("ja");

    expect(ui.toolbarLabel).toBe("Markdown 書式設定");
    expect(ui.actions.inlineCode.label).toBe("文中コード");
    expect(ui.actions.codeBlock.label).toBe("コードブロック");
    expect(ui.actions.taskList.label).toBe("チェックリスト");
    expect(ui.actions.table.label).toBe("表");
    expect(ui.actions.mermaid.label).toBe("図（Mermaid）");
    expect(ui.actions.table.tooltip).toContain("プレビューでは表");
    expect(ui.actions.inlineCode.tooltip).toContain("短いコード");
    expect(ui.placeholders).toEqual({
      editor: "ここに Markdown を入力してください。",
      bold: "太字",
      italic: "斜体",
      strikethrough: "取り消し線",
      link: "リンク",
      inlineCode: "コード",
      heading: "見出し",
      listItem: "リスト項目",
      task: "タスク",
      quote: "引用",
      codeBlock: "コード",
      table: { column1: "列 1", column2: "列 2", value1: "値 1", value2: "値 2" },
      mermaid: "flowchart TD\n    A[開始] --> B[終了]",
    });
  });

  it("provides complete English menu and feedback text", () => {
    const ui = getFormattingUi("en");

    expect(ui.groups).toEqual({ text: "Text", block: "Block", insert: "Insert" });
    expect(ui.actions.heading6.label).toBe("Heading 6");
    expect(ui.actions.codePowerShell.label).toBe("PowerShell");
    expect(ui.actions.more.label).toBe("More");
    expect(ui.feedback.mermaidInserted).toContain("Mermaid");
    expect(ui.feedback.multilineInlineCode).toContain("Code Block");
    expect(ui.placeholders.editor).toBe("Write Markdown here.");
    expect(ui.placeholders.italic).toBe("italic text");
    expect(ui.placeholders.table).toEqual({
      column1: "Column 1",
      column2: "Column 2",
      value1: "Value 1",
      value2: "Value 2",
    });
  });
});
