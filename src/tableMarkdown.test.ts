import { describe, expect, it } from "vitest";
import {
  createTableCellChange,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumnAfter,
  insertTableRowAfter,
  parseMarkdownTable,
  serializeMarkdownTable,
  setTableColumnAlignment,
  setTableCellAlignment,
  updateTableCell,
} from "./tableMarkdown";

const source = [
  "| Request | Reply |",
  "| --- | --- |",
  "| **A**<br><br>Line with \\| pipe | Answer<br>Second line |",
].join("\n");

describe("markdown table model", () => {
  it("persists cell alignment without changing the column and retains it through edits", () => {
    const table = parseMarkdownTable(source, 0, source.length)!;
    const aligned = setTableCellAlignment(table, 1, 0, "right");
    const saved = serializeMarkdownTable(aligned);
    const reopened = parseMarkdownTable(saved, 0, saved.length)!;
    expect(reopened.alignments).toEqual(table.alignments);
    expect(reopened.rows[0].cells[0].alignment).toBe("right");
    expect(reopened.headers[0].alignment).toBeUndefined();
    expect(reopened.rows[0].cells[0].text).toBe(table.rows[0].cells[0].text);
    const change = createTableCellChange(saved, reopened, 1, 0, "updated")!;
    const edited = saved.slice(0, change.from) + change.insert + saved.slice(change.to);
    expect(parseMarkdownTable(edited, 0, edited.length)!.rows[0].cells[0]).toMatchObject({ text: "updated", alignment: "right" });
    expect(serializeMarkdownTable(deleteTableColumn(reopened, 1))).toContain("<!--koharu:align=right-->");
  });
  it("rejects a stale range even when another cell contains identical text", () => {
    const source = "| A | B |\n| - | - |\n| x | x |";
    const table = parseMarkdownTable(source, 0, source.length)!;
    expect(createTableCellChange("1234" + source, table, 1, 1, "EDIT")).toBeNull();
  });
  it("rejects a single delimiter header instead of producing a reversed range", () => {
    const source = "|\n| - |";
    expect(parseMarkdownTable(source, 0, source.length)).toBeNull();
  });
  it("does not escape a closing delimiter when typing a trailing backslash", () => {
    const source = "|A|\n|-|\n|x|";
    const table = parseMarkdownTable(source, 0, source.length)!;
    const change = createTableCellChange(source, table, 1, 0, "path\\")!;
    const next = source.slice(0, change.from) + change.insert + source.slice(change.to);
    expect(parseMarkdownTable(next, 0, next.length)?.rows[0].cells[0].text).toBe("path\\");
  });
  it("parses the user's one-column table after a heading", () => {
    const prefix = "# 計画\n\n";
    const raw = "| 方針 |\n| --- |\n| **既存 CodeMirror**<br><br>改修 |";
    const table = parseMarkdownTable(prefix + raw, prefix.length, prefix.length + raw.length);

    expect(table?.headers).toHaveLength(1);
    expect(table?.rows[0].cells[0].text).toBe("**既存 CodeMirror**\n\n改修");
  });

  it("records cell payload ranges in full-document coordinates", () => {
    const prefix = "# Heading\r\n\r\n";
    const raw = "| A | B |\r\n| - | :-: |\r\n|  | value |";
    const document = prefix + raw + "\r\n\r\nAfter";
    const table = parseMarkdownTable(document, prefix.length, prefix.length + raw.length);

    expect(table?.headers[0].range).toEqual({
      from: prefix.length + 2,
      to: prefix.length + 3,
      raw: "A",
    });
    expect(table?.rows[0].cells[0].range?.raw).toBe("");
    expect(table?.rows[0].cells[1].range).toEqual({
      from: prefix.length + raw.lastIndexOf("value"),
      to: prefix.length + raw.lastIndexOf("value") + "value".length,
      raw: "value",
    });
  });

  it("accepts a header-only table, empty cells, and one-hyphen dividers", () => {
    const raw = "|  |\n| :--: |";
    const table = parseMarkdownTable(raw, 0, raw.length);

    expect(table?.headers).toEqual([
      expect.objectContaining({ text: "" }),
    ]);
    expect(table?.alignments).toEqual(["center"]);
    expect(table?.rows).toEqual([]);
  });

  it.each([
    ["divider", "| A | B |\n| --- |"],
    ["body row", "| A | B |\n| --- | --- |\n| only one |"],
    ["extra body cell", "| A |\n| --- |\n| one | extra |"],
  ])("rejects a table whose %s has a different column count", (_part, raw) => {
    expect(parseMarkdownTable(raw, 0, raw.length)).toBeNull();
  });

  it("reuses raw markdown for unchanged cells during structural serialization", () => {
    const raw = String.raw`| Path | Detail |
| - | - |
| C:\Temp\file \| value | \`code\` and [link](https://example.com/a\|b)<br>next |`;
    const table = parseMarkdownTable(raw, 0, raw.length);
    expect(table).not.toBeNull();

    const withColumn = insertTableColumnAfter(table!, 1, "Owner");
    const serialized = serializeMarkdownTable(withColumn);

    expect(serialized).toContain(String.raw`| C:\Temp\file \| value | \`code\` and [link](https://example.com/a\|b)<br>next |  |`);
  });

  it("creates a minimal cell change in full-document coordinates", () => {
    const prefix = "Before\r\n\r\n";
    const raw = "| A | B |\r\n| --- | --- |\r\n| x | keep |";
    const sourceWithContext = prefix + raw + "\r\nAfter";
    const table = parseMarkdownTable(sourceWithContext, prefix.length, prefix.length + raw.length)!;

    const change = createTableCellChange(sourceWithContext, table, 1, 0, "日本語")!;

    expect(change).toEqual({
      from: prefix.length + raw.lastIndexOf("x"),
      to: prefix.length + raw.lastIndexOf("x") + 1,
      insert: "日本語",
    });
    expect(sourceWithContext.slice(0, change.from) + change.insert + sourceWithContext.slice(change.to))
      .toBe(prefix + "| A | B |\r\n| --- | --- |\r\n| 日本語 | keep |\r\nAfter");
  });

  it("encodes pipes without multiplying literal backslashes across edits", () => {
    const raw = String.raw`| Value |
| - |
| C:\Temp \| slash\\\|pipe |`;
    const table = parseMarkdownTable(raw, 0, raw.length)!;
    expect(table.rows[0].cells[0].text).toBe("C:\\Temp | slash\\|pipe");

    const first = createTableCellChange(raw, table, 1, 0, `${table.rows[0].cells[0].text}!`)!;
    const once = raw.slice(0, first.from) + first.insert + raw.slice(first.to);
    const reparsed = parseMarkdownTable(once, 0, once.length)!;
    const second = createTableCellChange(once, reparsed, 1, 0, reparsed.rows[0].cells[0].text);

    expect(once).toBe(String.raw`| Value |
| - |
| C:\Temp \| slash\\\|pipe! |`);
    expect(second).toBeNull();
  });

  it("rejects a cell change when its recorded raw range is stale", () => {
    const raw = "| A |\n| - |\n| old |";
    const table = parseMarkdownTable(raw, 0, raw.length)!;
    const changedElsewhere = raw.replace("old", "new");

    expect(createTableCellChange(changedElsewhere, table, 1, 0, "edit")).toBeNull();
  });

  it("uses row zero for header cell changes", () => {
    const raw = "| Header |\n| - |\n| body |";
    const table = parseMarkdownTable(raw, 0, raw.length)!;
    const change = createTableCellChange(raw, table, 0, 0, "見出し")!;

    expect(raw.slice(0, change.from) + change.insert + raw.slice(change.to))
      .toBe("| 見出し |\n| - |\n| body |");
  });

  it("inserts into an empty cell while preserving its surrounding padding", () => {
    const raw = "| A |\n| - |\n|  |";
    const table = parseMarkdownTable(raw, 0, raw.length)!;
    const change = createTableCellChange(raw, table, 1, 0, "value")!;

    expect(raw.slice(0, change.from) + change.insert + raw.slice(change.to))
      .toBe("| A |\n| - |\n| value |");
  });

  it("sets one column alignment without changing cell markdown", () => {
    const raw = String.raw`| A | B |
| - | -: |
| C:\Temp \| value | **keep** |`;
    const table = parseMarkdownTable(raw, 0, raw.length)!;

    const centered = setTableColumnAlignment(table, 0, "center");

    expect(serializeMarkdownTable(centered)).toBe(String.raw`| A | B |
| :---: | ---: |
| C:\Temp \| value | **keep** |`);
    expect(table.alignments).toEqual(["none", "right"]);
  });

  it("preserves CRLF when a structural operation serializes the table", () => {
    const raw = "| A |\r\n| - |\r\n| body |";
    const table = parseMarkdownTable(raw, 0, raw.length)!;

    const withRow = insertTableRowAfter(table, 0);

    expect(serializeMarkdownTable(withRow)).toBe("| A |\r\n| --- |\r\n| body |\r\n|  |");
  });

  it("parses table cells and presents html breaks as editable line breaks", () => {
    const table = parseMarkdownTable(source, 0, source.length);

    expect(table?.headers.map((cell) => cell.text)).toEqual(["Request", "Reply"]);
    expect(table?.rows[0].cells[0].text).toBe("**A**\n\nLine with | pipe");
    expect(table?.rows[0].cells[1].text).toBe("Answer\nSecond line");
  });

  it("serializes edited cells back to markdown without exposing raw line breaks", () => {
    const table = parseMarkdownTable(source, 0, source.length);
    expect(table).not.toBeNull();

    const updated = updateTableCell(table!, 1, 1, "Changed\n\nReply");

    expect(serializeMarkdownTable(updated)).toContain("| **A**<br><br>Line with \\| pipe | Changed<br><br>Reply |");
  });

  it("can add rows and delete columns while preserving markdown table shape", () => {
    const table = parseMarkdownTable(source, 0, source.length);
    expect(table).not.toBeNull();

    const withRow = insertTableRowAfter(table!, 0);
    const withoutColumn = deleteTableColumn(withRow, 0);

    expect(serializeMarkdownTable(withoutColumn)).toBe([
      "| Reply |",
      "| --- |",
      "| Answer<br>Second line |",
      "|  |",
    ].join("\n"));
  });

  it("can add columns and delete rows while preserving existing cells", () => {
    const table = parseMarkdownTable(source, 0, source.length);
    expect(table).not.toBeNull();

    const withColumn = insertTableColumnAfter(table!, 0, "Owner");
    const withoutRow = deleteTableRow(withColumn, 0);

    expect(serializeMarkdownTable(withoutRow)).toBe([
      "| Request | Owner | Reply |",
      "| --- | --- | --- |",
    ].join("\n"));
  });

  it("parses long two-column note tables with wide delimiter rows", () => {
    const wide = [
      "| BPR / vendor request                                                                                                                                                  | Reply draft                                                                                                                                                           |",
      "| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |",
      "| **1. Environment**<br><br>Pattern A: production / staging / development.<br><br>Pattern B: production / staging-development.                                           | Please provide the purpose, D365 / Dataverse connection, data, required permissions, monthly cost, and operation scope for each environment proposal.<br><br>Thanks. |",
      "| **2. Login method**<br><br>Can developers use FMI Entra ID?<br><br>Is VPN required?                                                                                    | Use FMI-approved devices and Microsoft 365 accounts. MFA is required.                                                                                                  |",
    ].join("\n");

    const table = parseMarkdownTable(wide, 0, wide.length);

    expect(table?.headers.map((cell) => cell.text)).toEqual(["BPR / vendor request", "Reply draft"]);
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0].cells[0].text).toContain("Pattern A");
    expect(table?.rows[0].cells[1].text).toContain("Thanks.");
  });
});
