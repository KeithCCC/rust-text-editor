import { describe, expect, it } from "vitest";
import {
  deleteTableColumn,
  deleteTableRow,
  insertTableColumnAfter,
  insertTableRowAfter,
  parseMarkdownTable,
  serializeMarkdownTable,
  updateTableCell,
} from "./tableMarkdown";

const source = [
  "| Request | Reply |",
  "| --- | --- |",
  "| **A**<br><br>Line with \\| pipe | Answer<br>Second line |",
].join("\n");

describe("markdown table model", () => {
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
