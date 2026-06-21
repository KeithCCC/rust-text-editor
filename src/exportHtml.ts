type StandaloneHtmlOptions = {
  title: string;
  bodyHtml: string;
  css?: string;
};

const DEFAULT_EXPORT_CSS = `
body {
  margin: 0;
  background: #111820;
  color: #f4f7fb;
  font: 16px/1.65 "Segoe UI", system-ui, sans-serif;
}
.preview-body {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 32px;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th,
td {
  border: 1px solid #354151;
  padding: 8px 10px;
  vertical-align: top;
}
pre {
  overflow: auto;
  background: #0c1118;
  padding: 14px;
}
code {
  font-family: "Cascadia Code", Consolas, monospace;
}
a {
  color: #7cc7ff;
}
`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(value: string) {
  const escaped = escapeHtml(value).replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\[\[([^\]]+)\]\]/g, "<span class=\"wiki-link\">$1</span>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
      return `<a href="${escapeHtml(href)}">${label}</a>`;
    });
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function renderTable(lines: string[], start: number) {
  const header = splitTableRow(lines[start]);
  const rows: string[][] = [];
  let index = start + 2;
  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const head = `<thead><tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return { html: `<table>${head}${body}</table>`, nextIndex: index };
}

export function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let index = 0;
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph();
      const language = trimmed.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;
      html.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
      flushParagraph();
      const table = renderTable(lines, index);
      html.push(table.html);
      index = table.nextIndex;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return html.join("\n");
}

export function buildStandaloneHtml({ title, bodyHtml, css }: StandaloneHtmlOptions) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${css?.trim() || DEFAULT_EXPORT_CSS}</style>
</head>
<body>
  <main class="preview-body">
${bodyHtml}
  </main>
</body>
</html>
`;
}
