import { describe, expect, it } from "vitest";
import {
  shouldCycleViewMode,
  splitOrientationForWidth,
  splitPercentFromKey,
  splitPercentFromPointer,
} from "./responsiveLayout";

describe("responsive split geometry", () => {
  it("uses vertical splitting above 820px and horizontal stacking at 820px", () => {
    expect(splitOrientationForWidth(821)).toBe("vertical");
    expect(splitOrientationForWidth(820)).toBe("horizontal");
  });

  it("uses Y geometry and Up/Down keys for the stacked splitter", () => {
    expect(splitPercentFromPointer({
      orientation: "horizontal",
      clientX: 0,
      clientY: 300,
      left: 0,
      top: 100,
      width: 800,
      height: 400,
    })).toBe(50);
    expect(splitPercentFromKey(50, "horizontal", "ArrowUp")).toBe(48);
    expect(splitPercentFromKey(50, "horizontal", "ArrowDown")).toBe(52);
    expect(splitPercentFromKey(50, "horizontal", "ArrowRight")).toBeNull();
  });

  it("uses X geometry and Left/Right keys for the side-by-side splitter", () => {
    expect(splitPercentFromPointer({
      orientation: "vertical",
      clientX: 450,
      clientY: 0,
      left: 50,
      top: 0,
      width: 800,
      height: 400,
    })).toBe(50);
    expect(splitPercentFromKey(50, "vertical", "ArrowLeft")).toBe(48);
    expect(splitPercentFromKey(50, "vertical", "ArrowRight")).toBe(52);
    expect(splitPercentFromKey(50, "vertical", "ArrowDown")).toBeNull();
  });

  it("clamps pointer and keyboard resizing to the supported range", () => {
    expect(splitPercentFromPointer({
      orientation: "vertical",
      clientX: -100,
      clientY: 0,
      left: 0,
      top: 0,
      width: 800,
      height: 400,
    })).toBe(25);
    expect(splitPercentFromKey(25, "vertical", "ArrowLeft")).toBe(25);
    expect(splitPercentFromKey(75, "horizontal", "ArrowDown")).toBe(75);
  });
});

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
