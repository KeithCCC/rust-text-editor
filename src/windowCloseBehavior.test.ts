import { describe, expect, test, vi } from "vitest";
import { canCloseWindow } from "./windowCloseBehavior";

describe("canCloseWindow", () => {
  test("allows closing unchanged documents without prompting", () => {
    const confirm = vi.fn(() => false);

    expect(canCloseWindow(false, confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  test("uses the unsaved confirmation decision for modified documents", () => {
    expect(canCloseWindow(true, () => true)).toBe(true);
    expect(canCloseWindow(true, () => false)).toBe(false);
  });
});
