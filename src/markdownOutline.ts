export type OutlineHeading = {
  id: string;
  level: number;
  text: string;
  offset: number;
};

export function markdownOutlineHeadingId(offset: number) {
  return `markdown-heading-${offset}`;
}

export function parseMarkdownOutline(markdown: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  let fence: { marker: string; length: number } | null = null;

  for (const match of markdown.matchAll(/^.*$/gm)) {
    const line = match[0].replace(/\r$/, "");
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = { marker, length: fenceMatch[1].length };
      else if (marker === fence.marker && fenceMatch[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;

    const heading = /^( {0,3})(#{1,6})([ \t]+)(.+)$/.exec(line);
    if (!heading) continue;
    const text = `${heading[3]}${heading[4]}`.replace(/[ \t]+#+[ \t]*$/, "").trim();
    if (!text) continue;
    const offset = match.index + heading[1].length;
    headings.push({
      id: markdownOutlineHeadingId(offset),
      level: heading[2].length,
      text,
      offset,
    });
  }

  return headings;
}
