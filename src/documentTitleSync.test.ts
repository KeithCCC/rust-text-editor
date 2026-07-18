import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { synchronizeDocumentTitle } from "./documentTitleSync";

beforeEach(() => {
  vi.stubGlobal("document", { title: "" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("synchronizeDocumentTitle", () => {
  test("forwards a clean title to the browser and native setter", async () => {
    const setNativeTitle = vi.fn(async () => undefined);

    await synchronizeDocumentTitle("todo.md - Koharu", setNativeTitle);

    expect(document.title).toBe("todo.md - Koharu");
    expect(setNativeTitle).toHaveBeenCalledWith("todo.md - Koharu");
  });

  test("forwards a dirty title to the browser and native setter", async () => {
    const setNativeTitle = vi.fn(async () => undefined);

    await synchronizeDocumentTitle("*todo.md - Koharu", setNativeTitle);

    expect(document.title).toBe("*todo.md - Koharu");
    expect(setNativeTitle).toHaveBeenCalledWith("*todo.md - Koharu");
  });

  test("reports native title rejection without rejecting", async () => {
    const error = new Error("native title unavailable");
    const reportError = vi.fn();

    await expect(synchronizeDocumentTitle(
      "*todo.md - Koharu",
      async () => { throw error; },
      reportError,
    )).resolves.toBeUndefined();

    expect(reportError).toHaveBeenCalledWith(error);
  });
});
