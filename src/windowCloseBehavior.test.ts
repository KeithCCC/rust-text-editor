import { describe, expect, test, vi } from "vitest";
import { canCloseWindow, handleCloseRequested } from "./windowCloseBehavior";

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

describe("handleCloseRequested", () => {
  test("saves window state without prompting when the document is unchanged", async () => {
    const confirm = vi.fn(() => false);
    const preventDefault = vi.fn();
    const saveWindowState = vi.fn(async () => {});

    await handleCloseRequested({
      modified: false,
      confirmClose: confirm,
      preventDefault,
      saveWindowState,
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(saveWindowState).toHaveBeenCalledTimes(1);
  });

  test("prevents native close when a modified document close is canceled", async () => {
    const preventDefault = vi.fn();
    const saveWindowState = vi.fn(async () => {});

    await handleCloseRequested({
      modified: true,
      confirmClose: () => false,
      preventDefault,
      saveWindowState,
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(saveWindowState).not.toHaveBeenCalled();
  });

  test("saves window state when a modified document close is confirmed", async () => {
    const preventDefault = vi.fn();
    const saveWindowState = vi.fn(async () => {});

    await handleCloseRequested({
      modified: true,
      confirmClose: () => true,
      preventDefault,
      saveWindowState,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(saveWindowState).toHaveBeenCalledTimes(1);
  });
});
