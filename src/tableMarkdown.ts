export type MarkdownTableCell = {
  text: string;
};

export type MarkdownTableRow = {
  cells: MarkdownTableCell[];
};

export type MarkdownTable = {
  from: number;
  to: number;
  headers: MarkdownTableCell[];
  alignments: TableAlignment[];
  rows: MarkdownTableRow[];
};

export type TableAlignment = "left" | "center" | "right" | "none";

function decodeCellText(text: string) {
  return text.trim().replace(/<br\s*\/?>/gi, "\n").replace(/\\\|/g, "|");
}

function encodeCellText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function splitMarkdownTableRow(text: string) {
  const trimmed = text.trim();
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (const char of body) {
    if (escaped) {
      current += `\\${char}`;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "|") {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += "\\";
  }

  cells.push(current);
  return cells;
}

function parseAlignment(cell: string): TableAlignment | null {
  const value = cell.trim();
  if (!/^:?-{3,}:?$/.test(value)) {
    return null;
  }
  if (value.startsWith(":") && value.endsWith(":")) {
    return "center";
  }
  if (value.endsWith(":")) {
    return "right";
  }
  if (value.startsWith(":")) {
    return "left";
  }
  return "none";
}

export function isMarkdownTableDivider(text: string) {
  const cells = splitMarkdownTableRow(text);
  return cells.length > 1 && cells.every((cell) => parseAlignment(cell) !== null);
}

export function isMarkdownTableRow(text: string) {
  return text.includes("|") && splitMarkdownTableRow(text).length > 1;
}

function toCells(cells: string[]): MarkdownTableCell[] {
  return cells.map((cell) => ({ text: decodeCellText(cell) }));
}

export function parseMarkdownTable(source: string, from: number, to: number): MarkdownTable | null {
  const text = source.slice(from, to);
  const lines = text.split(/\r?\n/);
  if (lines.length < 2 || !isMarkdownTableRow(lines[0]) || !isMarkdownTableDivider(lines[1])) {
    return null;
  }

  const headers = toCells(splitMarkdownTableRow(lines[0]));
  const alignments = splitMarkdownTableRow(lines[1]).map((cell) => parseAlignment(cell) ?? "none");
  const rows: MarkdownTableRow[] = [];

  for (const line of lines.slice(2)) {
    if (!isMarkdownTableRow(line)) {
      return null;
    }
    rows.push({ cells: toCells(splitMarkdownTableRow(line)) });
  }

  return { from, to, headers, alignments, rows };
}

function serializeAlignment(alignment: TableAlignment) {
  switch (alignment) {
    case "left":
      return ":---";
    case "center":
      return ":---:";
    case "right":
      return "---:";
    default:
      return "---";
  }
}

function serializeCells(cells: MarkdownTableCell[], columnCount: number) {
  const values: string[] = [];
  for (let index = 0; index < columnCount; index += 1) {
    values.push(encodeCellText(cells[index]?.text ?? ""));
  }
  return `| ${values.join(" | ")} |`;
}

export function serializeMarkdownTable(table: MarkdownTable) {
  const columnCount = table.headers.length;
  return [
    serializeCells(table.headers, columnCount),
    `| ${table.alignments.slice(0, columnCount).map(serializeAlignment).join(" | ")} |`,
    ...table.rows.map((row) => serializeCells(row.cells, columnCount)),
  ].join("\n");
}

function cloneTable(table: MarkdownTable): MarkdownTable {
  return {
    from: table.from,
    to: table.to,
    headers: table.headers.map((cell) => ({ ...cell })),
    alignments: [...table.alignments],
    rows: table.rows.map((row) => ({ cells: row.cells.map((cell) => ({ ...cell })) })),
  };
}

export function updateTableCell(table: MarkdownTable, rowIndex: number, columnIndex: number, text: string) {
  const next = cloneTable(table);
  const targetRow = rowIndex === 0 ? { cells: next.headers } : next.rows[rowIndex - 1];
  if (!targetRow || columnIndex < 0 || columnIndex >= next.headers.length) {
    return next;
  }
  targetRow.cells[columnIndex] = { text };
  return next;
}

export function insertTableRowAfter(table: MarkdownTable, rowIndex: number) {
  const next = cloneTable(table);
  const emptyRow = { cells: next.headers.map(() => ({ text: "" })) };
  const insertAt = Math.max(0, Math.min(rowIndex + 1, next.rows.length));
  next.rows.splice(insertAt, 0, emptyRow);
  return next;
}

export function deleteTableRow(table: MarkdownTable, rowIndex: number) {
  const next = cloneTable(table);
  if (rowIndex < 0 || rowIndex >= next.rows.length) {
    return next;
  }
  next.rows.splice(rowIndex, 1);
  return next;
}

export function insertTableColumnAfter(table: MarkdownTable, columnIndex: number, header = "") {
  const next = cloneTable(table);
  const insertAt = Math.max(0, Math.min(columnIndex + 1, next.headers.length));
  next.headers.splice(insertAt, 0, { text: header });
  next.alignments.splice(insertAt, 0, "none");
  for (const row of next.rows) {
    row.cells.splice(insertAt, 0, { text: "" });
  }
  return next;
}

export function deleteTableColumn(table: MarkdownTable, columnIndex: number) {
  const next = cloneTable(table);
  if (next.headers.length <= 1 || columnIndex < 0 || columnIndex >= next.headers.length) {
    return next;
  }
  next.headers.splice(columnIndex, 1);
  next.alignments.splice(columnIndex, 1);
  for (const row of next.rows) {
    row.cells.splice(columnIndex, 1);
  }
  return next;
}
