export type ViewMode = "edit" | "split" | "preview";

export function resolveViewMode(value: string | null): ViewMode {
  if (value === "split" || value === "preview") return value;
  return "edit";
}

export function cycleViewMode(mode: ViewMode): ViewMode {
  if (mode === "edit") return "split";
  if (mode === "split") return "preview";
  return "edit";
}
