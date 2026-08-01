export type ToolbarNavigationKey = "ArrowLeft" | "ArrowRight" | "Home" | "End";

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
