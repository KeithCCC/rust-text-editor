export type ToolbarNavigationKey = "ArrowLeft" | "ArrowRight" | "Home" | "End";

export type NavigationControl = {
  disabled: boolean;
  hidden: boolean;
  focus: () => void;
};

type NavigationEvent = {
  key: string;
  preventDefault: () => void;
};

export function nextToolbarIndex(
  current: number,
  count: number,
  key: ToolbarNavigationKey,
): number {
  if (count <= 0) return 0;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  return (current + 1) % count;
}

function availableControlIndexes(controls: readonly NavigationControl[]): number[] {
  return controls.flatMap((control, index) => (
    control && !control.disabled && !control.hidden ? [index] : []
  ));
}

export function focusMenuBoundary(
  controls: readonly NavigationControl[],
  boundary: "first" | "last",
): number | null {
  const available = availableControlIndexes(controls);
  const index = boundary === "first" ? available[0] : available[available.length - 1];
  if (index === undefined) return null;
  controls[index].focus();
  return index;
}

export function restoreMenuTriggerFocus(
  trigger: Pick<NavigationControl, "disabled" | "focus"> | null,
  onClose: () => void,
): void {
  onClose();
  if (trigger && !trigger.disabled) trigger.focus();
}

export function dispatchToolbarNavigation(
  event: NavigationEvent,
  current: number,
  controls: readonly NavigationControl[],
): number | null {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return null;
  const available = availableControlIndexes(controls);
  if (available.length === 0) return null;
  event.preventDefault();
  const currentAvailableIndex = Math.max(0, available.indexOf(current));
  const nextAvailableIndex = nextToolbarIndex(
    currentAvailableIndex,
    available.length,
    event.key as ToolbarNavigationKey,
  );
  const nextIndex = available[nextAvailableIndex];
  controls[nextIndex].focus();
  return nextIndex;
}

export function dispatchMenuNavigation(
  event: NavigationEvent,
  current: number,
  controls: readonly NavigationControl[],
  onEscape: () => void,
): number | null {
  if (event.key === "Escape") {
    event.preventDefault();
    onEscape();
    return null;
  }
  const toolbarKey = event.key === "ArrowUp"
    ? "ArrowLeft"
    : event.key === "ArrowDown"
      ? "ArrowRight"
      : event.key;
  return dispatchToolbarNavigation(
    { key: toolbarKey, preventDefault: () => event.preventDefault() },
    current,
    controls,
  );
}
