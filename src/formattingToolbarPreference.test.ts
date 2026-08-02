import { describe, expect, it, vi } from "vitest";
import {
  readFormattingToolbarVisibility,
  writeFormattingToolbarVisibility,
} from "./formattingToolbarPreference";

describe("formatting toolbar preference", () => {
  it("defaults to visible unless storage contains a recognized value", () => {
    const storage = { getItem: vi.fn() };
    for (const [stored, expected] of [[null, true], ["visible", true], ["hidden", false], ["broken", true]] as const) {
      storage.getItem.mockReturnValueOnce(stored);
      expect(readFormattingToolbarVisibility(storage)).toBe(expected);
    }
  });

  it("falls back to visible when storage cannot be read", () => {
    expect(readFormattingToolbarVisibility({ getItem: () => { throw new Error("denied"); } })).toBe(true);
  });

  it("keeps the default-storage path silent when localStorage access is denied", () => {
    const deniedWindow = {};
    Object.defineProperty(deniedWindow, "localStorage", {
      get: () => {
        throw new Error("denied");
      },
    });
    vi.stubGlobal("window", deniedWindow);

    try {
      expect(readFormattingToolbarVisibility()).toBe(true);
      expect(() => writeFormattingToolbarVisibility(false)).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("writes only the recognized visible and hidden values without surfacing storage errors", () => {
    const setItem = vi.fn();
    writeFormattingToolbarVisibility(false, { setItem });
    writeFormattingToolbarVisibility(true, { setItem });
    expect(setItem.mock.calls).toEqual([
      ["koharu-formatting-toolbar-visibility", "hidden"],
      ["koharu-formatting-toolbar-visibility", "visible"],
    ]);
    expect(() => writeFormattingToolbarVisibility(false, {
      setItem: () => { throw new Error("denied"); },
    })).not.toThrow();
  });
});
