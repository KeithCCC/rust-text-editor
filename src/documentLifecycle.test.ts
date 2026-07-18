import { describe, expect, test, vi } from "vitest";
import { runDocumentTransition, type UnsavedDecision } from "./documentLifecycle";

function setup(modified: boolean) {
  return {
    modified,
    requestDecision: vi.fn<() => Promise<UnsavedDecision>>(async () => "cancel"),
    save: vi.fn(async () => true),
    discardRecovery: vi.fn(async () => undefined),
    proceed: vi.fn(async () => undefined),
  };
}

describe("runDocumentTransition", () => {
  test("proceeds without prompting for a clean document", async () => {
    const options = setup(false);
    expect(await runDocumentTransition(options)).toBe(true);
    expect(options.requestDecision).not.toHaveBeenCalled();
    expect(options.proceed).toHaveBeenCalledTimes(1);
  });

  test("saves before proceeding", async () => {
    const options = setup(true);
    options.requestDecision.mockResolvedValue("save");
    expect(await runDocumentTransition(options)).toBe(true);
    expect(options.save).toHaveBeenCalledTimes(1);
    expect(options.proceed).toHaveBeenCalledTimes(1);
  });

  test("stops when Save As is canceled or saving fails", async () => {
    const options = setup(true);
    options.requestDecision.mockResolvedValue("save");
    options.save.mockResolvedValue(false);
    expect(await runDocumentTransition(options)).toBe(false);
    expect(options.proceed).not.toHaveBeenCalled();
  });

  test("clears recovery before discarding and proceeding", async () => {
    const order: string[] = [];
    const options = setup(true);
    options.requestDecision.mockResolvedValue("discard");
    options.discardRecovery.mockImplementation(async () => { order.push("discard"); });
    options.proceed.mockImplementation(async () => { order.push("proceed"); });
    expect(await runDocumentTransition(options)).toBe(true);
    expect(order).toEqual(["discard", "proceed"]);
  });

  test("stops without rejecting when recovery cannot be discarded", async () => {
    const options = setup(true);
    options.requestDecision.mockResolvedValue("discard");
    options.discardRecovery.mockRejectedValue(new Error("draft is locked"));

    await expect(runDocumentTransition(options)).resolves.toBe(false);
    expect(options.proceed).not.toHaveBeenCalled();
  });

  test("Cancel preserves the document", async () => {
    const options = setup(true);
    expect(await runDocumentTransition(options)).toBe(false);
    expect(options.save).not.toHaveBeenCalled();
    expect(options.discardRecovery).not.toHaveBeenCalled();
    expect(options.proceed).not.toHaveBeenCalled();
  });
});
