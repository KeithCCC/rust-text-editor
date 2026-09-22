type HtmlNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HtmlNode[];
};

/** Consume only Koharu's leading cell metadata; keep Markdown source offsets intact. */
export function tableCellAlignment() {
  return (tree: HtmlNode) => {
    function visit(node: HtmlNode) {
      if (node.tagName === "td" || node.tagName === "th") {
        const first = node.children?.[0];
        const alignment = first?.type === "comment" && /^koharu:align=(left|center|right)$/.exec(first.value ?? "");
        if (alignment) {
          node.properties = { ...node.properties, align: alignment[1] };
          node.children!.shift();
        }
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
