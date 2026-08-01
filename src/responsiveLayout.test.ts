import { describe, expect, it } from "vitest";
import { shouldCycleViewMode } from "./responsiveLayout";

describe("responsive layout shortcuts", () => {
  it("uses Ctrl or Command plus Alt+M for mode cycling", () => {
    expect(shouldCycleViewMode({
      ctrlKey: true,
      metaKey: false,
      altKey: true,
      shiftKey: false,
      key: "m",
      isComposing: false,
    })).toBe(true);
    expect(shouldCycleViewMode({
      ctrlKey: false,
      metaKey: true,
      altKey: true,
      shiftKey: false,
      key: "M",
      isComposing: false,
    })).toBe(true);
    expect(shouldCycleViewMode({
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: true,
      key: "v",
      isComposing: false,
    })).toBe(false);
  });

  it("does not cycle during IME composition", () => {
    expect(shouldCycleViewMode({
      ctrlKey: true,
      metaKey: false,
      altKey: true,
      shiftKey: false,
      key: "m",
      isComposing: true,
    })).toBe(false);
  });
});
