import type { CSSProperties } from "react";
import type { OutlineHeading } from "../markdownOutline";

type OutlinePanelProps = {
  title: string;
  emptyText: string;
  headings: OutlineHeading[];
  onSelect: (heading: OutlineHeading) => void;
  onClose: () => void;
};

export function OutlinePanel({ title, emptyText, headings, onSelect, onClose }: OutlinePanelProps) {
  return (
    <aside className="outline-panel" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`} title={`Close ${title}`}>×</button>
      </header>
      {headings.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <nav aria-label={title}>
          {headings.map((heading) => (
            <button
              key={heading.id}
              type="button"
              style={{ "--outline-level": heading.level } as CSSProperties}
              onClick={() => onSelect(heading)}
              title={heading.text}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}
