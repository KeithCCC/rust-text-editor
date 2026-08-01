import type { ViewMode } from "../viewMode";

type ViewModeSwitcherProps = {
  mode: ViewMode;
  labels: Record<ViewMode, string>;
  onChange: (mode: ViewMode) => void;
};

const MODES: ViewMode[] = ["edit", "split", "preview"];

export function ViewModeSwitcher({ mode, labels, onChange }: ViewModeSwitcherProps) {
  return (
    <div className="view-mode-switcher" role="group" aria-label="View mode" data-mode={mode}>
      {MODES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          aria-label={labels[candidate]}
          aria-pressed={mode === candidate}
          title={labels[candidate]}
          onClick={() => onChange(candidate)}
        >
          {labels[candidate]}
        </button>
      ))}
    </div>
  );
}
