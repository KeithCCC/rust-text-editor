export type OutlineHeading = {
  level: number;
  text: string;
  offset: number;
  index: number;
};

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

    const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    headings.push({
      level: heading[1].length,
      text: heading[2],
      offset: match.index,
      index: headings.length,
    });
  }

  return headings;
}
