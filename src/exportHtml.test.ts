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
});

describe("buildStandaloneHtml", () => {
  it("wraps body content in a complete html document", () => {
    const html = buildStandaloneHtml({
      title: "Project <Plan>",
      bodyHtml: "<h1>Project</h1>",
      css: ".preview-body { color: white; }",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Project &lt;Plan&gt;</title>");
    expect(html).toContain("<style>");
    expect(html).toContain("<main class=\"preview-body\">");
  });
});
