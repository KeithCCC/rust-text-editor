export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type CodeLanguage =
  | ""
  | "markdown"
  | "javascript"
  | "typescript"
  | "json"
  | "rust"
  | "bash"
  | "powershell";

export type MarkdownCommand =
  | { kind: "bold" | "italic" | "strikethrough" | "link" | "inlineCode" }
  | { kind: "heading"; level: HeadingLevel }
  | { kind: "bulletList" | "numberedList" | "taskList" | "quote" | "table" | "mermaid" }
  | { kind: "codeBlock"; language: CodeLanguage };

export type FormattingPlaceholders = {
  editor: string;
  bold: string;
  italic: string;
  strikethrough: string;
  link: string;
  inlineCode: string;
  heading: string;
  listItem: string;
  task: string;
  quote: string;
  codeBlock: string;
  table: { column1: string; column2: string; value1: string; value2: string };
  mermaid: string;
};

export const DEFAULT_FORMATTING_PLACEHOLDERS: FormattingPlaceholders = {
  editor: "Write Markdown here.",
  bold: "bold text",
  italic: "italic text",
  strikethrough: "strikethrough text",
  link: "link text",
  inlineCode: "code",
  heading: "Heading",
  listItem: "List item",
  task: "Task",
  quote: "Quote",
  codeBlock: "code",
  table: { column1: "Column 1", column2: "Column 2", value1: "Value 1", value2: "Value 2" },
  mermaid: "flowchart TD\n    A[Start] --> B[End]",
};

export type FormatSelection = { from: number; to: number };

export type FormatResult = {
  from: number;
  to: number;
  insert: string;
  selectionStart: number;
  selectionEnd: number;
  feedback?: "codeBlockInserted" | "tableInserted" | "mermaidInserted";
  warning?: "multilineInlineCode";
};

export type FormattingContext = {
  headingLevel: HeadingLevel | null;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  inlineCode: boolean;
};

function detectEol(document: string): "\r\n" | "\n" {
  return document.includes("\r\n") ? "\r\n" : "\n";
}

function inlineDelimiter(content: string) {
  const longest = Math.max(0, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length));
  return "`".repeat(longest + 1);
}

function codeSpanPadding(content: string): "" | " " {
  const hasEdgeBacktick = content.startsWith("`") || content.endsWith("`");
  const hasSymmetricSpaces = content.startsWith(" ")
    && content.endsWith(" ")
    && !/^ +$/.test(content);
  return hasEdgeBacktick || hasSymmetricSpaces ? " " : "";
}

function lineBounds(document: string, selection: FormatSelection): FormatSelection {
  const previousOffset = selection.from - 1;
  const startBreak = selection.from === 0
    ? -1
    : Math.max(
      document.lastIndexOf("\n", previousOffset),
      document.lastIndexOf("\r", previousOffset),
    );
  const from = startBreak === -1 ? 0 : startBreak + 1;
  const trailingBreak = selection.to > selection.from && /[\r\n]/.test(document[selection.to - 1]);
  if (trailingBreak) {
    const endsAfterCrLf = document[selection.to - 1] === "\n" && document[selection.to - 2] === "\r";
    return { from, to: selection.to - (endsAfterCrLf ? 2 : 1) };
  }
  const nextLf = document.indexOf("\n", selection.to);
  const nextCr = document.indexOf("\r", selection.to);
  const candidates = [nextLf, nextCr].filter((value) => value >= 0);
  const to = candidates.length === 0 ? document.length : Math.min(...candidates);
  return { from, to };
}

function fenceFor(content: string): string {
  const longest = Math.max(2, ...Array.from(content.matchAll(/`{3,}/g), (match) => match[0].length));
  return "`".repeat(longest + 1);
}

function blockBoundaryBefore(document: string, offset: number, eol: string): string {
  if (offset === 0 || document.slice(0, offset).endsWith(`${eol}${eol}`)) {
    return "";
  }
  return document.slice(0, offset).endsWith(eol) ? eol : `${eol}${eol}`;
}

function blockBoundaryAfter(document: string, offset: number, eol: string): string {
  if (offset === document.length || document.slice(offset).startsWith(`${eol}${eol}`)) {
    return "";
  }
  return document.slice(offset).startsWith(eol) ? eol : `${eol}${eol}`;
}

type LineMarker = "heading" | "bulletList" | "numberedList" | "taskList" | "quote";

function lineMarker(line: string): { kind: LineMarker; length: number; headingLevel?: number } | null {
  const heading = /^(#{1,6})[ \t]+/.exec(line);
  if (heading) {
    return { kind: "heading", length: heading[0].length, headingLevel: heading[1].length };
  }
  const task = /^[-+*][ \t]+\[[ xX]\][ \t]+/.exec(line);
  if (task) {
    return { kind: "taskList", length: task[0].length };
  }
  const bullet = /^[-+*][ \t]+/.exec(line);
  if (bullet) {
    return { kind: "bulletList", length: bullet[0].length };
  }
  const numbered = /^\d+\.[ \t]+/.exec(line);
  if (numbered) {
    return { kind: "numberedList", length: numbered[0].length };
  }
  const quote = /^>[ \t]?/.exec(line);
  return quote ? { kind: "quote", length: quote[0].length } : null;
}

function toggleWrapper(
  document: string,
  selection: FormatSelection,
  before: string,
  after: string,
  placeholder: string,
): FormatResult {
  const selected = document.slice(selection.from, selection.to);
  const outerFrom = selection.from - before.length;
  const outerTo = selection.to + after.length;
  if (
    outerFrom >= 0
    && document.slice(outerFrom, selection.from) === before
    && document.slice(selection.to, outerTo) === after
  ) {
    return {
      from: outerFrom,
      to: outerTo,
      insert: selected,
      selectionStart: 0,
      selectionEnd: selected.length,
    };
  }
  const body = selected || placeholder;
  const insert = `${before}${body}${after}`;
  return {
    from: selection.from,
    to: selection.to,
    insert,
    selectionStart: before.length,
    selectionEnd: before.length + body.length,
  };
}

function toggleEmphasis(
  document: string,
  selection: FormatSelection,
  strength: 1 | 2,
  placeholder: string,
): FormatResult {
  const selected = document.slice(selection.from, selection.to);
  for (const marker of ["*", "_"] as const) {
    if (!hasExactEmphasisAround(document, selection, marker, strength)) continue;
    return {
      from: selection.from - strength,
      to: selection.to + strength,
      insert: selected,
      selectionStart: 0,
      selectionEnd: selected.length,
    };
  }
  const body = selected || placeholder;
  const leadingWhitespace = /^[^\S\r\n]*/u.exec(body)?.[0] ?? "";
  const bodyAfterLeadingWhitespace = body.slice(leadingWhitespace.length);
  const trailingWhitespace = /[^\S\r\n]*$/u.exec(bodyAfterLeadingWhitespace)?.[0] ?? "";
  const core = bodyAfterLeadingWhitespace.slice(
    0,
    bodyAfterLeadingWhitespace.length - trailingWhitespace.length,
  );
  if (!core) {
    return {
      from: selection.from,
      to: selection.to,
      insert: selected,
      selectionStart: 0,
      selectionEnd: selected.length,
    };
  }
  for (const marker of ["*", "_"] as const) {
    const delimiter = marker.repeat(strength);
    const insert = `${leadingWhitespace}${delimiter}${core}${delimiter}${trailingWhitespace}`;
    const candidateDocument = `${document.slice(0, selection.from)}${insert}${document.slice(selection.to)}`;
    const candidateSelection = {
      from: selection.from + leadingWhitespace.length + strength,
      to: selection.from + leadingWhitespace.length + strength + core.length,
    };
    if (!hasExactEmphasisAround(candidateDocument, candidateSelection, marker, strength)) continue;
    const selectionStart = leadingWhitespace.length + strength;
    return {
      from: selection.from,
      to: selection.to,
      insert,
      selectionStart,
      selectionEnd: selectionStart + core.length,
    };
  }
  return {
    from: selection.from,
    to: selection.to,
    insert: selected,
    selectionStart: 0,
    selectionEnd: selected.length,
  };
}

function toggleInlineCode(
  document: string,
  selection: FormatSelection,
  placeholder: string,
): FormatResult {
  const selected = document.slice(selection.from, selection.to);
  const body = selected || placeholder;
  const delimiter = inlineDelimiter(body);
  const padding = codeSpanPadding(body);
  if (selected) {
    const before = `${delimiter}${padding}`;
    const after = `${padding}${delimiter}`;
    const outerFrom = selection.from - before.length;
    const outerTo = selection.to + after.length;
    if (
      outerFrom >= 0
      && document.slice(outerFrom, selection.from) === before
      && document.slice(selection.to, outerTo) === after
      && document[outerFrom - 1] !== "`"
      && document[outerTo] !== "`"
    ) {
      return {
        from: outerFrom,
        to: outerTo,
        insert: selected,
        selectionStart: 0,
        selectionEnd: selected.length,
      };
    }
  }
  const insert = `${delimiter}${padding}${body}${padding}${delimiter}`;
  const selectionStart = delimiter.length + padding.length;
  return {
    from: selection.from,
    to: selection.to,
    insert,
    selectionStart,
    selectionEnd: selectionStart + body.length,
  };
}

function escapeTableCell(cell: string): string {
  return cell.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

export function formatMarkdownSelection(
  document: string,
  selection: FormatSelection,
  command: MarkdownCommand,
  placeholders: FormattingPlaceholders = DEFAULT_FORMATTING_PLACEHOLDERS,
): FormatResult {
  const selected = document.slice(selection.from, selection.to);
  const eol = detectEol(document);
  const replacement = (
    range: FormatSelection,
    insert: string,
    selectionStart = 0,
    selectionEnd = insert.length,
    metadata: Pick<FormatResult, "feedback" | "warning"> = {},
  ): FormatResult => ({
    from: range.from,
    to: range.to,
    insert,
    selectionStart,
    selectionEnd,
    ...metadata,
  });
  const change = (
    insert: string,
    selectionStart = 0,
    selectionEnd = insert.length,
    metadata: Pick<FormatResult, "feedback" | "warning"> = {},
  ) => replacement(selection, insert, selectionStart, selectionEnd, metadata);
  const prefixLines = (
    target: LineMarker,
    prefix: (index: number) => string,
    placeholder: string,
    headingLevel?: HeadingLevel,
  ) => {
    const bounds = lineBounds(document, selection);
    const lineSelection = document.slice(bounds.from, bounds.to);
    const body = lineSelection || placeholder;
    const lines = body.split(/\r\n|\n/);
    const isTarget = (line: string) => {
      const marker = lineMarker(line);
      return marker?.kind === target
        && (target !== "heading" || marker.headingLevel === headingLevel);
    };
    const toggleOff = Boolean(lineSelection)
      && lines.some((line) => isTarget(line))
      && lines.every((line) => line.length === 0 || isTarget(line));
    const insert = body
      .split(/\r\n|\n/)
      .map((line, index) => {
        const marker = lineMarker(line);
        const content = marker ? line.slice(marker.length) : line;
        return toggleOff || line.length === 0 ? content : `${prefix(index)}${content}`;
      })
      .join(eol);
    return lineSelection
      ? replacement(bounds, insert)
      : replacement(bounds, insert, prefix(0).length, insert.length);
  };
  const fencedBlock = (
    body: string,
    language: string,
    feedback: NonNullable<FormatResult["feedback"]>,
  ) => {
    const fence = fenceFor(body);
    const opening = `${fence}${language}${eol}`;
    const closingGap = body.endsWith(eol) ? "" : eol;
    const leading = blockBoundaryBefore(document, selection.from, eol);
    const trailing = blockBoundaryAfter(document, selection.to, eol);
    const insert = `${leading}${opening}${body}${closingGap}${fence}${trailing}`;
    const bodyStart = leading.length + opening.length;
    return change(insert, bodyStart, bodyStart + body.length, { feedback });
  };

  switch (command.kind) {
    case "bold":
      return toggleEmphasis(document, selection, 2, placeholders.bold);
    case "italic":
      return toggleEmphasis(document, selection, 1, placeholders.italic);
    case "strikethrough":
      return toggleWrapper(document, selection, "~~", "~~", placeholders.strikethrough);
    case "link": {
      const result = toggleWrapper(document, selection, "[", "](https://example.com)", placeholders.link);
      if (result.from !== selection.from || result.to !== selection.to || !selected) {
        return result;
      }
      const urlStart = selected.length + 3;
      return {
        ...result,
        selectionStart: urlStart,
        selectionEnd: urlStart + "https://example.com".length,
      };
    }
    case "inlineCode": {
      if (/[\r\n]/.test(selected)) {
        return change(selected, 0, selected.length, { warning: "multilineInlineCode" });
      }
      return toggleInlineCode(document, selection, placeholders.inlineCode);
    }
    case "heading":
      return prefixLines("heading", () => `${"#".repeat(command.level)} `, placeholders.heading, command.level);
    case "bulletList":
      return prefixLines("bulletList", () => "- ", placeholders.listItem);
    case "numberedList":
      return prefixLines("numberedList", (index) => `${index + 1}. `, placeholders.listItem);
    case "taskList":
      return prefixLines("taskList", () => "- [ ] ", placeholders.task);
    case "quote":
      return prefixLines("quote", () => "> ", placeholders.quote);
    case "codeBlock": {
      const body = selected || placeholders.codeBlock;
      return fencedBlock(body, command.language, "codeBlockInserted");
    }
    case "table": {
      const hasTrailingEol = /(?:\r\n|\n)$/.test(selected);
      const selectedRows = selected.split(/\r\n|\n/);
      const nonEmptyRows = selectedRows.filter((row) => row.length > 0);
      const isTsvSelection = Boolean(selected)
        && !hasTrailingEol
        && nonEmptyRows.length > 0
        && nonEmptyRows.every((row) => row.split("\t").length >= 2);
      if (isTsvSelection) {
        const rows = selectedRows.map((row) => row.split("\t"));
        const columnCount = Math.max(...rows.map((row) => row.length));
        const rowText = (row: string[]) => `| ${Array.from(
          { length: columnCount },
          (_, index) => escapeTableCell(row[index] ?? ""),
        ).join(" | ")} |`;
        const table = [
          rowText(rows[0]),
          rowText(Array.from({ length: columnCount }, () => "---")),
          ...rows.slice(1).map(rowText),
        ].join(eol);
        const leading = blockBoundaryBefore(document, selection.from, eol);
        const trailing = blockBoundaryAfter(document, selection.to, eol);
        return change(
          `${leading}${table}${trailing}`,
          leading.length,
          leading.length + table.length,
          { feedback: "tableInserted" },
        );
      }

      const { column1, column2, value1, value2 } = placeholders.table;
      const table = `| ${column1} | ${column2} |${eol}| --- | --- |${eol}| ${value1} | ${value2} |`;
      const columnOffset = table.indexOf(column1);
      if (selected) {
        const leading = blockBoundaryBefore(document, selection.to, eol);
        const trailing = blockBoundaryAfter(document, selection.to, eol);
        const insert = `${selected}${leading}${table}${trailing}`;
        const columnStart = selected.length + leading.length + columnOffset;
        return change(insert, columnStart, columnStart + column1.length, { feedback: "tableInserted" });
      }
      const leading = blockBoundaryBefore(document, selection.from, eol);
      const trailing = blockBoundaryAfter(document, selection.to, eol);
      const insert = `${leading}${table}${trailing}`;
      const columnStart = leading.length + columnOffset;
      return change(insert, columnStart, columnStart + column1.length, { feedback: "tableInserted" });
    }
    case "mermaid": {
      const body = selected || placeholders.mermaid.replace(/\r\n|\n/g, eol);
      return fencedBlock(body, "mermaid", "mermaidInserted");
    }
  }
}

const emptyFormattingContext = (): FormattingContext => ({
  headingLevel: null,
  bold: false,
  italic: false,
  strikethrough: false,
  inlineCode: false,
});

type InlineSpan = { from: number; to: number };

function isEscaped(line: string, offset: number): boolean {
  let backslashes = 0;
  for (let index = offset - 1; index >= 0 && line[index] === "\\"; index -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function isBoundary(character: string | undefined): boolean {
  return character === undefined || /[\s\p{P}\p{S}]/u.test(character);
}

function findInlineCodeSpans(line: string): InlineSpan[] {
  const runs = Array.from(line.matchAll(/`+/g), (match) => ({
    from: match.index,
    to: match.index + match[0].length,
    length: match[0].length,
  })).filter((run) => !isEscaped(line, run.from));
  const spans: InlineSpan[] = [];

  for (let index = 0; index < runs.length;) {
    const left = runs[index];
    const relativeClose = runs.slice(index + 1).findIndex((right) => right.length === left.length);
    if (relativeClose < 0) {
      index += 1;
      continue;
    }
    const closeIndex = index + relativeClose + 1;
    spans.push({ from: left.to, to: runs[closeIndex].from });
    index = closeIndex + 1;
  }
  return spans;
}

type EmphasisMarker = "*" | "_";
type EmphasisStrength = 1 | 2;
type EmphasisDelimiterRun = {
  marker: EmphasisMarker;
  from: number;
  to: number;
  length: number;
  canOpen: boolean;
  canClose: boolean;
};
type EmphasisSpan = InlineSpan & { marker: EmphasisMarker; strength: EmphasisStrength };

function isWhitespace(character: string | undefined): boolean {
  return character === undefined || /\s/u.test(character);
}

function isPunctuation(character: string | undefined): boolean {
  return character !== undefined && /[\p{P}\p{S}]/u.test(character);
}

function findEmphasisDelimiterRuns(
  line: string,
  excludedSpans: InlineSpan[],
): EmphasisDelimiterRun[] {
  return Array.from(line.matchAll(/\*+|_+/g), (match) => {
    const marker = match[0][0] as EmphasisMarker;
    const from = match.index;
    const to = from + match[0].length;
    const previous = line[from - 1];
    const next = line[to];
    const leftFlanking = !isWhitespace(next)
      && (!isPunctuation(next) || isWhitespace(previous) || isPunctuation(previous));
    const rightFlanking = !isWhitespace(previous)
      && (!isPunctuation(previous) || isWhitespace(next) || isPunctuation(next));
    return {
      marker,
      from,
      to,
      length: match[0].length,
      canOpen: marker === "*"
        ? leftFlanking
        : leftFlanking && (!rightFlanking || isPunctuation(previous)),
      canClose: marker === "*"
        ? rightFlanking
        : rightFlanking && (!leftFlanking || isPunctuation(next)),
    };
  }).filter((run) => (
    !isEscaped(line, run.from)
    && !excludedSpans.some((span) => span.from <= run.from && run.to <= span.to)
  ));
}

function canPairEmphasisRuns(
  opening: EmphasisDelimiterRun,
  closing: EmphasisDelimiterRun,
): boolean {
  if (opening.marker !== closing.marker || opening.to >= closing.from) return false;
  const ruleOfThreeApplies = opening.canClose || closing.canOpen;
  return !(
    ruleOfThreeApplies
    && (opening.length + closing.length) % 3 === 0
    && (opening.length % 3 !== 0 || closing.length % 3 !== 0)
  );
}

function findEmphasisSpans(line: string, excludedSpans: InlineSpan[]): EmphasisSpan[] {
  const runs = findEmphasisDelimiterRuns(line, excludedSpans);
  const spans: EmphasisSpan[] = [];

  for (const marker of ["*", "_"] as const) {
    for (const strength of [1, 2] as const) {
      const eligibleRuns = runs.filter((run) => (
        run.marker === marker
        && run.length >= strength
        && (strength === 2 || run.length % 2 === 1)
      ));
      const openings: EmphasisDelimiterRun[] = [];
      for (const run of eligibleRuns) {
        let matched = false;
        if (run.canClose) {
          let openingIndex = openings.length - 1;
          while (openingIndex >= 0 && !canPairEmphasisRuns(openings[openingIndex], run)) {
            openingIndex -= 1;
          }
          if (openingIndex >= 0) {
            const [opening] = openings.splice(openingIndex, 1);
            spans.push({ from: opening.to, to: run.from, marker, strength });
            matched = true;
          }
        }
        if (!matched && run.canOpen) openings.push(run);
      }
    }
  }

  const spansCross = (left: EmphasisSpan, right: EmphasisSpan) => (
    (left.from < right.from && right.from < left.to && left.to < right.to)
    || (right.from < left.from && left.from < right.to && right.to < left.to)
  );
  return spans.filter((span, index) => !spans.some((other, otherIndex) => (
    index !== otherIndex && spansCross(span, other)
  )));
}

function hasExactEmphasisAround(
  document: string,
  selection: FormatSelection,
  marker: EmphasisMarker,
  strength: EmphasisStrength,
): boolean {
  if (/(?:\r\n|\n)[\t ]*(?:\r\n|\n)/.test(document.slice(selection.from, selection.to))) {
    return false;
  }
  const lineStart = document.lastIndexOf("\n", selection.from - 1) + 1;
  const nextLineBreak = document.indexOf("\n", selection.to);
  const rawLineEnd = nextLineBreak < 0 ? document.length : nextLineBreak;
  const lineEnd = rawLineEnd > lineStart && document[rawLineEnd - 1] === "\r"
    ? rawLineEnd - 1
    : rawLineEnd;
  if (selection.to > lineEnd) return false;

  const delimiter = marker.repeat(strength);
  if (
    selection.from - strength < lineStart
    || document.slice(selection.from - strength, selection.from) !== delimiter
    || document.slice(selection.to, selection.to + strength) !== delimiter
  ) {
    return false;
  }

  const line = document.slice(lineStart, lineEnd);
  const codeSpans = findInlineCodeSpans(line);
  const relativeFrom = selection.from - lineStart;
  const relativeTo = selection.to - lineStart;
  return findEmphasisSpans(line, codeSpans).some((span) => (
    span.marker === marker
    && span.strength === strength
    && span.from === relativeFrom
    && span.to === relativeTo
  ));
}

function isSurrounded(
  line: string,
  from: number,
  to: number,
  delimiter: string,
  excludedSpans: InlineSpan[],
): boolean {
  let opening: number | null = null;
  let offset = line.indexOf(delimiter);
  while (offset >= 0) {
    const insideExcludedSpan = excludedSpans.some((span) => (
      span.from <= offset && offset + delimiter.length <= span.to
    ));
    const previous = line[offset - 1];
    const next = line[offset + delimiter.length];
    const canOpen = isBoundary(previous) && next !== undefined && !/\s/.test(next);
    const canClose = previous !== undefined && !/\s/.test(previous) && isBoundary(next);

    if (!insideExcludedSpan && !isEscaped(line, offset)) {
      if (opening === null && canOpen) {
        opening = offset;
      } else if (opening !== null) {
        if (canClose) {
          if (opening + delimiter.length <= from && offset >= to) {
            return true;
          }
          opening = null;
        } else {
          opening = canOpen ? offset : null;
        }
      }
    }
    offset = line.indexOf(delimiter, offset + delimiter.length);
  }
  return false;
}

function hasInlineCodeAround(spans: InlineSpan[], from: number, to: number): boolean {
  return spans.some((span) => span.from <= from && span.to >= to);
}

export function detectFormattingContext(
  document: string,
  selection: FormatSelection,
): FormattingContext {
  if (
    selection.from < 0
    || selection.to < selection.from
    || selection.to > document.length
    || /[\r\n]/.test(document.slice(selection.from, selection.to))
  ) {
    return emptyFormattingContext();
  }

  const lineStart = document.lastIndexOf("\n", selection.from - 1) + 1;
  const nextLineBreak = document.indexOf("\n", selection.to);
  const rawLineEnd = nextLineBreak < 0 ? document.length : nextLineBreak;
  const lineEnd = rawLineEnd > lineStart && document[rawLineEnd - 1] === "\r"
    ? rawLineEnd - 1
    : rawLineEnd;
  if (selection.to > lineEnd) {
    return emptyFormattingContext();
  }

  const line = document.slice(lineStart, lineEnd);
  const relativeFrom = selection.from - lineStart;
  const relativeTo = selection.to - lineStart;
  const heading = /^(#{1,6})\s/.exec(line);
  const inlineCodeSpans = findInlineCodeSpans(line);
  const emphasisSpans = findEmphasisSpans(line, inlineCodeSpans);
  const hasEmphasis = (strength: EmphasisStrength) => emphasisSpans.some((span) => (
    span.strength === strength
    && span.from <= relativeFrom
    && span.to >= relativeTo
  ));

  return {
    headingLevel: heading ? heading[1].length as HeadingLevel : null,
    bold: hasEmphasis(2),
    italic: hasEmphasis(1),
    strikethrough: isSurrounded(line, relativeFrom, relativeTo, "~~", inlineCodeSpans),
    inlineCode: hasInlineCodeAround(inlineCodeSpans, relativeFrom, relativeTo),
  };
}
