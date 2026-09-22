export type MarkdownTableCell = {
  text: string;
  alignment?: TableAlignment;
  range?: TableCellRange;
};

export type TableCellRange = {
  from: number;
  to: number;
  raw: string;
};

export type MarkdownTableRow = {
  cells: MarkdownTableCell[];
};

export type MarkdownTable = {
  sourceText?: string;
  from: number;
  to: number;
  lineSeparator?: "\n" | "\r\n";
  headers: MarkdownTableCell[];
  alignments: TableAlignment[];
  rows: MarkdownTableRow[];
};

export type TableAlignment = "left" | "center" | "right" | "none";

export type TableTextChange = {
  from: number;
  to: number;
  insert: string;
};

function decodeCellText(text: string) {
  const normalized = text.replace(/<br\s*\/?>/gi, "\n");
  let decoded = "";

  for (let index = 0; index < normalized.length;) {
    if (normalized[index] !== "\\") {
      decoded += normalized[index];
      index += 1;
      continue;
    }

    let runEnd = index;
    while (normalized[runEnd] === "\\") {
      runEnd += 1;
    }
    const slashCount = runEnd - index;
    if (normalized[runEnd] === "|" && slashCount % 2 === 1) {
      decoded += "\\".repeat(Math.floor(slashCount / 2));
      decoded += "|";
      index = runEnd + 1;
      continue;
    }

    decoded += "\\".repeat(slashCount);
    index = runEnd;
  }

  return decoded;
}

function encodeCellText(text: string) {
  const normalized = text.replace(/\r\n|\r|\n/g, "<br>");
  let encoded = "";

  for (let index = 0; index < normalized.length;) {
    if (normalized[index] !== "\\") {
      encoded += normalized[index] === "|" ? "\\|" : normalized[index];
      index += 1;
      continue;
    }

    let runEnd = index;
    while (normalized[runEnd] === "\\") {
      runEnd += 1;
    }
    const slashCount = runEnd - index;
    if (normalized[runEnd] === "|") {
      encoded += "\\".repeat(slashCount * 2 + 1);
      encoded += "|";
      index = runEnd + 1;
      continue;
    }

    encoded += "\\".repeat(slashCount);
    index = runEnd;
  }

  return encoded;
}

type ParsedRowCell = {
  raw: string;
  from: number;
  to: number;
};

function isEscapedPipe(text: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function parseRowCells(text: string, lineFrom = 0): ParsedRowCell[] | null {
  let trimmedFrom = 0;
  while (trimmedFrom < text.length && /[ \t]/.test(text[trimmedFrom])) {
    trimmedFrom += 1;
  }
  let trimmedTo = text.length;
  while (trimmedTo > trimmedFrom && /[ \t]/.test(text[trimmedTo - 1])) {
    trimmedTo -= 1;
  }

  let hasPipe = false;
  for (let index = trimmedFrom; index < trimmedTo; index += 1) {
    if (text[index] === "|" && !isEscapedPipe(text, index)) {
      hasPipe = true;
      break;
    }
  }
  if (!hasPipe) {
    return null;
  }

  const bodyFrom = text[trimmedFrom] === "|" ? trimmedFrom + 1 : trimmedFrom;
  const bodyTo = text[trimmedTo - 1] === "|" && !isEscapedPipe(text, trimmedTo - 1)
    ? trimmedTo - 1
    : trimmedTo;
  if (bodyFrom > bodyTo) return null;
  const boundaries = [bodyFrom];
  for (let index = bodyFrom; index < bodyTo; index += 1) {
    if (text[index] === "|" && !isEscapedPipe(text, index)) {
      boundaries.push(index + 1);
    }
  }

  return boundaries.map((segmentFrom, index) => {
    const segmentTo = index + 1 < boundaries.length ? boundaries[index + 1] - 1 : bodyTo;
    let contentFrom = segmentFrom;
    while (contentFrom < segmentTo && /[ \t]/.test(text[contentFrom])) {
      contentFrom += 1;
    }
    let contentTo = segmentTo;
    while (contentTo > contentFrom && /[ \t]/.test(text[contentTo - 1])) {
      contentTo -= 1;
    }
    if (contentFrom === segmentTo && segmentTo > segmentFrom) {
      contentFrom = segmentFrom + 1;
      contentTo = contentFrom;
    }

    return {
      raw: text.slice(contentFrom, contentTo),
      from: lineFrom + contentFrom,
      to: lineFrom + contentTo,
    };
  });
}

export function splitMarkdownTableRow(text: string) {
  return parseRowCells(text)?.map((cell) => cell.raw) ?? [];
}

function parseAlignment(cell: string): TableAlignment | null {
  const value = cell.trim();
  if (!/^:?-+:?$/.test(value)) {
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
  return cells.length > 0 && cells.every((cell) => parseAlignment(cell) !== null);
}

export function isMarkdownTableRow(text: string) {
  return splitMarkdownTableRow(text).length > 0;
}

function toCells(cells: ParsedRowCell[]): MarkdownTableCell[] {
  return cells.map((cell) => {
    const marker = /^<!--koharu:align=(left|center|right)-->/.exec(cell.raw);
    const raw = cell.raw.slice(marker?.[0].length ?? 0);
    return {
      text: decodeCellText(raw),
      ...(marker ? { alignment: marker[1] as TableAlignment } : {}),
      range: { from: cell.from + (marker?.[0].length ?? 0), to: cell.to, raw },
    };
  });
}

function sourceLines(source: string, from: number, to: number) {
  const lines: Array<{ text: string; from: number }> = [];
  let lineFrom = from;
  while (lineFrom <= to) {
    const newline = source.indexOf("\n", lineFrom);
    const lineBreak = newline === -1 || newline >= to ? to : newline;
    const lineTo = lineBreak > lineFrom && source[lineBreak - 1] === "\r" ? lineBreak - 1 : lineBreak;
    lines.push({ text: source.slice(lineFrom, lineTo), from: lineFrom });
    if (lineBreak === to) {
      break;
    }
    lineFrom = lineBreak + 1;
  }
  return lines;
}

export function parseMarkdownTable(source: string, from: number, to: number): MarkdownTable | null {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > source.length) {
    return null;
  }

  const lines = sourceLines(source, from, to);
  if (lines.length < 2 || !isMarkdownTableDivider(lines[1].text)) {
    return null;
  }

  const headerCells = parseRowCells(lines[0].text, lines[0].from);
  const dividerCells = parseRowCells(lines[1].text, lines[1].from);
  if (!headerCells || !dividerCells || headerCells.length !== dividerCells.length) {
    return null;
  }

  const headers = toCells(headerCells);
  const alignments = dividerCells.map((cell) => parseAlignment(cell.raw) ?? "none");
  const rows: MarkdownTableRow[] = [];

  for (const line of lines.slice(2)) {
    const cells = parseRowCells(line.text, line.from);
    if (!cells || cells.length !== headers.length) {
      return null;
    }
    rows.push({ cells: toCells(cells) });
  }

  const firstNewline = source.indexOf("\n", from);
  const lineSeparator = firstNewline > from && source[firstNewline - 1] === "\r" ? "\r\n" : "\n";
  return { from, to, lineSeparator, headers, alignments, rows, sourceText: source.slice(from, to) };
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
    const cell = cells[index];
    const value = cell?.range && decodeCellText(cell.range.raw) === cell.text
      ? cell.range.raw
      : encodeCellText(cell?.text ?? "");
    values.push((cell?.alignment && cell.alignment !== "none" ? `<!--koharu:align=${cell.alignment}-->` : "") + value);
  }
  return `| ${values.join(" | ")} |`;
}

export function serializeMarkdownTable(table: MarkdownTable) {
  const columnCount = table.headers.length;
  return [
    serializeCells(table.headers, columnCount),
    `| ${table.alignments.slice(0, columnCount).map(serializeAlignment).join(" | ")} |`,
    ...table.rows.map((row) => serializeCells(row.cells, columnCount)),
  ].join(table.lineSeparator ?? "\n");
}

function cloneTable(table: MarkdownTable): MarkdownTable {
  return {
    sourceText: table.sourceText,
    from: table.from,
    to: table.to,
    lineSeparator: table.lineSeparator,
    headers: table.headers.map((cell) => ({ ...cell, range: cell.range ? { ...cell.range } : undefined })),
    alignments: [...table.alignments],
    rows: table.rows.map((row) => ({
      cells: row.cells.map((cell) => ({ ...cell, range: cell.range ? { ...cell.range } : undefined })),
    })),
  };
}

export function updateTableCell(table: MarkdownTable, rowIndex: number, columnIndex: number, text: string) {
  const next = cloneTable(table);
  const targetRow = rowIndex === 0 ? { cells: next.headers } : next.rows[rowIndex - 1];
  if (!targetRow || columnIndex < 0 || columnIndex >= next.headers.length) {
    return next;
  }
  targetRow.cells[columnIndex] = { text, alignment: targetRow.cells[columnIndex].alignment };
  return next;
}

export function createTableCellChange(
  source: string,
  table: MarkdownTable,
  row: number,
  column: number,
  text: string,
): TableTextChange | null {
  const target = row === 0 ? table.headers[column] : table.rows[row - 1]?.cells[column];
  const range = target?.range;
  if (
    !target
    || !range
    || column < 0
    || table.from < 0
    || table.to > source.length
    || range.from < table.from
    || range.to < range.from
    || range.to > table.to
    || table.sourceText !== undefined && source.slice(table.from, table.to) !== table.sourceText
    || source.slice(range.from, range.to) !== range.raw
    || target.text === text
  ) {
    return null;
  }

  let insert = encodeCellText(text);
  if (!text.trim() && (column === 0 || column === table.headers.length - 1)) {
    const lineFrom = source.lastIndexOf("\n", range.from - 1) + 1;
    const newline = source.indexOf("\n", range.to);
    const lineTo = newline < 0 ? source.length : source[newline - 1] === "\r" ? newline - 1 : newline;
    const rowText = source.slice(lineFrom, lineTo);
    const trimmed = rowText.trim();
    const hasStart = trimmed.startsWith("|");
    const hasEnd = trimmed.endsWith("|") && !isEscapedPipe(trimmed, trimmed.length - 1);
    if (column === 0 && !hasStart || column === table.headers.length - 1 && !hasEnd) {
      // Empty edge cells in a borderless row would turn its only separators
      // into optional borders. Add borders while retaining every other byte.
      const row = source.slice(lineFrom, range.from) + insert + source.slice(range.to, lineTo);
      return { from: lineFrom, to: lineTo, insert: `${hasStart ? "" : "| "}${row}${hasEnd ? "" : " |"}` };
    }
  }
  // An unpadded cell must not let a trailing backslash escape its delimiter.
  if (source[range.to] === "|" && /(?:^|[^\\])(?:\\\\)*\\$/.test(insert)) insert += " ";
  return { from: range.from, to: range.to, insert };
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

export function setTableColumnAlignment(
  table: MarkdownTable,
  column: number,
  alignment: TableAlignment,
) {
  const next = cloneTable(table);
  if (column < 0 || column >= next.alignments.length) {
    return next;
  }
  next.alignments[column] = alignment;
  return next;
}

export function setTableCellAlignment(table: MarkdownTable, row: number, column: number, alignment: TableAlignment) {
  const next = cloneTable(table);
  const cell = (row === 0 ? next.headers : next.rows[row - 1]?.cells)?.[column];
  if (cell) cell.alignment = alignment;
  return next;
}
