import { useMemo, useRef, useEffect } from "react";
import type { CommandDefinition, CommandId } from "../commands";
import { formatShortcut } from "../commands";

type CommandPaletteProps = {
  isOpen: boolean;
  query: string;
  commands: CommandDefinition[];
  disabledCommands: Set<CommandId>;
  placeholder: string;
  cancelLabel: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onRun: (id: CommandId) => void;
};

export function CommandPalette({
  isOpen,
  query,
  commands,
  disabledCommands,
  placeholder,
  cancelLabel,
  onQueryChange,
  onClose,
  onRun,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return commands;
    }

    return commands.filter((command) => command.label.toLowerCase().includes(normalized));
  }, [commands, query]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <section className="command-palette-backdrop" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="command-palette">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const first = filtered.find((command) => !disabledCommands.has(command.id));
              if (first) {
                onRun(first.id);
              }
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <div className="command-list">
          {filtered.length === 0 && <div className="command-empty">No commands</div>}
          {filtered.map((command) => {
            const disabled = disabledCommands.has(command.id);

            return (
              <button
                key={command.id}
                type="button"
                disabled={disabled}
                onClick={() => onRun(command.id)}
              >
                <span>{command.label}</span>
                <kbd>{formatShortcut(command.shortcut)}</kbd>
              </button>
            );
          })}
        </div>
        <div className="command-palette-actions">
          <button type="button" onClick={onClose}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
