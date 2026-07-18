import { describe, expect, test, vi } from "vitest";
import {
  ExcalidrawContentBaseline,
  persistExcalidrawSnapshot,
  projectPersistableExcalidrawAppState,
} from "./excalidrawDirty";

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

  test("marks a canvas background change dirty", () => {
    const baseline = new ExcalidrawContentBaseline(
      originalElements,
      originalFiles,
      { viewBackgroundColor: "#ffffff" },
    );

    expect(baseline.isDirty(
      originalElements,
      originalFiles,
      { viewBackgroundColor: "#ffeecc" },
    )).toBe(true);
  });

  test("ignores volatile selection and viewport app-state changes", () => {
    const baseline = new ExcalidrawContentBaseline(
      originalElements,
      originalFiles,
      { viewBackgroundColor: "#ffffff", scrollX: 0, selectedElementIds: {} },
    );

    expect(baseline.isDirty(
      originalElements,
      originalFiles,
      {
        viewBackgroundColor: "#ffffff",
        scrollX: 800,
        scrollY: 400,
        zoom: { value: 2 },
        selectedElementIds: { box: true },
      },
    )).toBe(false);
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

test("projects only Excalidraw's document-level persisted app state", () => {
  expect(projectPersistableExcalidrawAppState({
    viewBackgroundColor: "#ffeecc",
    gridModeEnabled: true,
    gridSize: 20,
    gridStep: 5,
    scrollX: 800,
    selectedElementIds: { box: true },
    collaborators: new Map(),
  })).toEqual({
    viewBackgroundColor: "#ffeecc",
    gridModeEnabled: true,
    gridSize: 20,
    gridStep: 5,
  });
});

test("normalizes a sparse scene to Excalidraw's persisted defaults", () => {
  expect(projectPersistableExcalidrawAppState({})).toEqual({
    viewBackgroundColor: "#ffffff",
    gridModeEnabled: false,
    gridSize: 20,
    gridStep: 5,
  });
});

describe("persistExcalidrawSnapshot", () => {
  const savedElements = [{ ...originalElements[0], x: 42 }];

  test("returns clean after persisting the current content", async () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);
    const onDirtyChange = vi.fn();

    await expect(persistExcalidrawSnapshot({
      baseline,
      snapshot: { elements: savedElements, files: originalFiles },
      write: async () => undefined,
      getCurrent: () => ({ elements: savedElements, files: originalFiles }),
      onDirtyChange,
    })).resolves.toBe(true);

    expect(onDirtyChange).toHaveBeenCalledWith(false);
    expect(baseline.isDirty(savedElements, originalFiles)).toBe(false);
  });

  test("returns dirty when content changes while the snapshot is being written", async () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);
    const newerElements = [{ ...originalElements[0], x: 84 }];
    let currentElements = savedElements;
    let finishWrite!: () => void;
    const onDirtyChange = vi.fn();
    const saving = persistExcalidrawSnapshot({
      baseline,
      snapshot: { elements: savedElements, files: originalFiles },
      write: () => new Promise<void>((resolve) => { finishWrite = resolve; }),
      getCurrent: () => ({ elements: currentElements, files: originalFiles }),
      onDirtyChange,
    });

    currentElements = newerElements;
    finishWrite();

    await expect(saving).resolves.toBe(false);
    expect(onDirtyChange).toHaveBeenCalledWith(true);
    expect(baseline.isDirty(newerElements, originalFiles)).toBe(true);
  });

  test("returns dirty when the background changes while a save is in flight", async () => {
    const baseline = new ExcalidrawContentBaseline(
      originalElements,
      originalFiles,
      { viewBackgroundColor: "#ffffff" },
    );
    let currentBackground = "#ffeecc";
    let finishWrite!: () => void;
    const onDirtyChange = vi.fn();
    const saving = persistExcalidrawSnapshot({
      baseline,
      snapshot: {
        elements: originalElements,
        files: originalFiles,
        appState: { viewBackgroundColor: "#ffeecc" },
      },
      write: () => new Promise<void>((resolve) => { finishWrite = resolve; }),
      getCurrent: () => ({
        elements: originalElements,
        files: originalFiles,
        appState: { viewBackgroundColor: currentBackground },
      }),
      onDirtyChange,
    });

    currentBackground = "#ccffee";
    finishWrite();

    await expect(saving).resolves.toBe(false);
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  test("preserves the written snapshot when a live collection mutates during writing", async () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);
    const liveElements = [{ ...originalElements[0], x: 42 }];
    let finishWrite!: () => void;
    const onDirtyChange = vi.fn();
    const saving = persistExcalidrawSnapshot({
      baseline,
      snapshot: { elements: liveElements, files: originalFiles },
      write: () => new Promise<void>((resolve) => { finishWrite = resolve; }),
      getCurrent: () => ({ elements: liveElements, files: originalFiles }),
      onDirtyChange,
    });

    liveElements[0].x = 84;
    finishWrite();

    await expect(saving).resolves.toBe(false);
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  test("keeps the previous baseline and dirty state when writing fails", async () => {
    const baseline = new ExcalidrawContentBaseline(originalElements, originalFiles);
    const onDirtyChange = vi.fn();

    await expect(persistExcalidrawSnapshot({
      baseline,
      snapshot: { elements: savedElements, files: originalFiles },
      write: async () => { throw new Error("disk full"); },
      getCurrent: () => ({ elements: savedElements, files: originalFiles }),
      onDirtyChange,
    })).rejects.toThrow("disk full");

    expect(onDirtyChange).not.toHaveBeenCalled();
    expect(baseline.isDirty(savedElements, originalFiles)).toBe(true);
  });
});
