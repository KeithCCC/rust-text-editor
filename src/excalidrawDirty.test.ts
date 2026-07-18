import { describe, expect, test } from "vitest";
import { ExcalidrawContentBaseline } from "./excalidrawDirty";

const originalElements = [{ id: "box", type: "rectangle", x: 10, y: 20 }];
const originalFiles = {
  image1: { id: "image1", dataURL: "data:image/png;base64,AA==", mimeType: "image/png" },
};

describe("ExcalidrawContentBaseline", () => {
  test("treats Excalidraw defaults for an empty sparse scene as clean", () => {
    const baseline = new ExcalidrawContentBaseline(undefined, undefined);

    expect(baseline.isDirty([], {})).toBe(false);
  });

  test("treats the unchanged scene opened by Excalidraw as clean", () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);

    expect(baseline.isDirty(
      [{ y: 20, x: 10, type: "rectangle", id: "box" }],
      { image1: { mimeType: "image/png", dataURL: "data:image/png;base64,AA==", id: "image1" } },
    )).toBe(false);
  });

  test("ignores app-state-only changes by comparing content inputs only", () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);

    expect(baseline.isDirty(originalElements, originalFiles)).toBe(false);
  });

  test("marks element content changes dirty", () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);

    expect(baseline.isDirty([{ ...originalElements[0], x: 42 }], originalFiles)).toBe(true);
  });

  test("marks embedded file content changes dirty", () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);

    expect(baseline.isDirty(originalElements, {
      ...originalFiles,
      image2: { id: "image2", dataURL: "data:image/png;base64,BB==", mimeType: "image/png" },
    })).toBe(true);
  });

  test("resetting the baseline after save makes current content clean", () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);
    const savedElements = [{ ...originalElements[0], x: 42 }];

    expect(baseline.isDirty(savedElements, originalFiles)).toBe(true);
    baseline.reset(savedElements, originalFiles);
    expect(baseline.isDirty(savedElements, originalFiles)).toBe(false);
  });
});
