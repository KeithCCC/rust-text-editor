import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  heading: <path d="M6 5v14M18 5v14M6 12h12" />,
  bold: <path d="M7 12h7a4 4 0 0 0 0-8H7v16h8a4 4 0 0 0 0-8H7" />,
  italic: <path d="M10 4h9M5 20h9M15 4 9 20" />,
  strikethrough: <path d="M18 6c-1-2-3-2-5-2-3 0-5 1-5 4 0 2 2 3 4 4M6 18c1 2 3 2 6 2 3 0 5-1 5-4M3 12h18" />,
  link: <><path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.92 1)" /></>,
  inlineCode: <path d="m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16" />,
  quote: <><path d="M9 12H4V6h6v7c0 4-2 5-5 6M19 12h-5V6h6v7c0 4-2 5-5 6" /></>,
  list: <><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  codeBlock: <><rect x="2" y="3" width="20" height="18" rx="2" /><path d="m9 8-4 4 4 4m6-8 4 4-4 4" /></>,
  table: <><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 9h18M3 15h18M9 9v12M15 9v12" /></>,
  mermaid: <><rect x="8" y="2" width="8" height="5" rx="1" /><rect x="2" y="17" width="7" height="5" rx="1" /><rect x="15" y="17" width="7" height="5" rx="1" /><path d="M12 7v5M5.5 17v-5h13v5" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
};

export function ToolbarIcon({ name }: { name: string }) {
  return (
    <svg className={`toolbar-icon${name === "chevron" ? " toolbar-chevron" : ""}`}
      viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}
