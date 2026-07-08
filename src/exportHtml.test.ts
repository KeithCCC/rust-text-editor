import { describe, expect, it } from "vitest";
import { buildStandaloneHtml, markdownToHtml } from "./exportHtml";

describe("markdownToHtml", () => {
  it("renders core markdown as escaped html", () => {
    const html = markdownToHtml("# Title\n\nHello **world** and <script>alert(1)</script>.");

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders markdown tables", () => {
    const html = markdownToHtml("| A | B |\n| --- | --- |\n| One | Two<br><br>Three |");

    expect(html).toContain("<table>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>Two<br><br>Three</td>");
  });

  it("renders mermaid fences as export diagram containers", () => {
    const html = markdownToHtml("```mermaid\ngraph TD\nA[<script>] --> B\n```");

    expect(html).toContain("<pre class=\"mermaid\">");
    expect(html).toContain("graph TD");
    expect(html).toContain("A[&lt;script&gt;] --&gt; B");
    expect(html).not.toContain("<code class=\"language-mermaid\">");
  });

  it("keeps non-mermaid fences as escaped code blocks", () => {
    const html = markdownToHtml("```js\nconsole.log('<safe>')\n```");

    expect(html).toContain("<pre><code class=\"language-js\">");
    expect(html).toContain("console.log('&lt;safe&gt;')");
  });
});

describe("buildStandaloneHtml", () => {
  it("wraps body content in a complete html document", async () => {
    const html = await buildStandaloneHtml({
      title: "Project <Plan>",
      bodyHtml: "<h1>Project</h1>",
      css: ".preview-body { color: white; }",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Project &lt;Plan&gt;</title>");
    expect(html).toContain("<style>");
    expect(html).toContain("<main class=\"preview-body\">");
  });

  it("embeds the mermaid runtime only when the export contains diagrams", async () => {
    const withoutMermaid = await buildStandaloneHtml({
      title: "Plain",
      bodyHtml: "<h1>Plain</h1>",
    });
    const withMermaid = await buildStandaloneHtml({
      title: "Diagram",
      bodyHtml: "<pre class=\"mermaid\">graph TD\nA --&gt; B</pre>",
      mermaidRuntime: "window.mermaid = { initialize() {} };",
    });

    expect(withoutMermaid).not.toContain("mermaid.initialize");
    expect(withMermaid).toContain("mermaid.initialize");
    expect(withMermaid).toContain("securityLevel: \"strict\"");
    expect(withMermaid).toContain("startOnLoad: true");
  });
});
