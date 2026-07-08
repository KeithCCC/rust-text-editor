type StandaloneHtmlOptions = {
  title: string;
  bodyHtml: string;
  css?: string;
  mermaidRuntime?: string;
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
.mermaid {
  background: #18202b;
  border: 1px solid #354151;
  border-radius: 8px;
  color: #f4f7fb;
  padding: 18px;
  text-align: center;
}
.mermaid svg {
  max-width: 100%;
  height: auto;
}
`;

const MERMAID_EXPORT_INIT = `
<script>
mermaid.initialize({
  startOnLoad: true,
  securityLevel: "strict",
  theme: "base",
  themeVariables: {
    background: "#18202b",
    primaryColor: "#243448",
    primaryTextColor: "#f4f8fc",
    primaryBorderColor: "#6ea8ff",
    lineColor: "#8fb8e8",
    secondaryColor: "#263c33",
    tertiaryColor: "#2d263d",
    clusterBkg: "#202a36",
    clusterBorder: "#536071",
    edgeLabelBackground: "#18202b",
    fontFamily: "Inter, Segoe UI, sans-serif"
  }
});
</script>`;

async function getMermaidExportScripts(bodyHtml: string, providedRuntime?: string) {
  if (!bodyHtml.includes('class="mermaid"')) {
    return "";
  }

  const mermaidRuntime = providedRuntime ?? (await import("mermaid/dist/mermaid.min.js?raw")).default;
  return `
<script>${escapeScript(mermaidRuntime)}</script>
${MERMAID_EXPORT_INIT}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeScript(value: string) {
  return value.replace(/<\/script/gi, "<\\/script");
}

function getFenceLanguage(info: string) {
  return info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
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
      const fenceLanguage = getFenceLanguage(language);
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;
      if (fenceLanguage === "mermaid") {
        html.push(`<pre class="mermaid">${escapeHtml(code.join("\n"))}</pre>`);
        continue;
      }
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

export async function buildStandaloneHtml({ title, bodyHtml, css, mermaidRuntime }: StandaloneHtmlOptions) {
  const mermaidScripts = await getMermaidExportScripts(bodyHtml, mermaidRuntime);

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
${mermaidScripts}
</body>
</html>
`;
}
