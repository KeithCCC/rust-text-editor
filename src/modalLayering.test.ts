import { describe, expect, test } from "vitest";
import { MODAL_LAYERS } from "./modalLayers";

describe("modal layering", () => {
  test("keeps a save decision above an active Excalidraw editor", () => {
    expect(MODAL_LAYERS.decision).toBeGreaterThan(MODAL_LAYERS.excalidraw);
  });
});
