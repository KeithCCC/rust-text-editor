type HtmlNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HtmlNode[];
};

const allowedTags = new Set("p div span h1 h2 h3 h4 h5 h6 ul ol li blockquote pre code em strong del s b i br hr a img table thead tbody tfoot tr th td input sup sub details summary dl dt dd main section article aside header footer figure figcaption address mark small abbr cite kbd samp var time".split(" "));
const blockedTags = new Set("script style iframe object embed link meta base form button textarea select option noscript template svg math audio video source track canvas".split(" "));
const allowedProperties = new Set(["className", "title", "alt", "href", "src", "colSpan", "rowSpan", "align", "start", "type", "checked", "disabled"]);

// Run after rehype-raw, before React creates DOM nodes, so raw HTML cannot
// trigger requests or execute active content in the staging WebView.
export function sanitizePdfMarkdown() {
  return (tree: HtmlNode) => {
    function visit(node: HtmlNode) {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "element" && blockedTags.has(child.tagName ?? "")) return [];
        visit(child);
        // Unknown inert wrappers must not discard visible document content.
        if (child.type === "element" && !allowedTags.has(child.tagName ?? "")) return child.children ?? [];
        if (child.properties) {
          for (const key of Object.keys(child.properties)) {
            if (!allowedProperties.has(key)) delete child.properties[key];
          }
          if (child.tagName === "input") {
            child.properties = { type: "checkbox", checked: Boolean(child.properties.checked), disabled: true };
          }
          // Images are loaded explicitly and checked by the PDF exporter.
          if (child.tagName === "img") {
            child.properties["dataPdfSrc"] = child.properties.src ?? "";
            delete child.properties.src;
          }
        }
        return [child];
      });
    }
    visit(tree);
  };
}
