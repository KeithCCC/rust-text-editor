import { useEffect, useId, useRef } from "react";
import { MODAL_LAYERS } from "../modalLayers";

type DecisionAction = {
  id: string;
  label: string;
  emphasis?: "primary" | "danger";
};

type DecisionDialogProps = {
  title: string;
  message: string;
  actions: readonly DecisionAction[];
  cancelId: string;
  onDecision: (id: string) => void;
};

export function DecisionDialog({
  title,
  message,
  actions,
  cancelId,
  onDecision,
}: DecisionDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDecision(cancelId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelId, onDecision]);

  return (
    <div
      className="modal-backdrop decision-dialog-backdrop"
      style={{ zIndex: MODAL_LAYERS.decision }}
    >
      <section
        className="decision-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <div className="decision-dialog-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              ref={action.id === cancelId ? cancelRef : undefined}
              type="button"
              className={action.emphasis ? `decision-${action.emphasis}` : undefined}
              onClick={() => onDecision(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
