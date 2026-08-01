import { describe, expect, test, vi } from "vitest";
import {
  runApplicationCloseTransition,
  runDocumentTransition,
  type UnsavedDecision,
} from "./documentLifecycle";

function setup(modified: boolean) {
  return {
    modified,
    requestDecision: vi.fn<() => Promise<UnsavedDecision>>(async () => "cancel"),
    save: vi.fn(async () => true),
    discardRecovery: vi.fn(async () => undefined),
    proceed: vi.fn<() => Promise<boolean>>(async () => true),
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

  test("clears recovery only after a discarded document opens", async () => {
    const order: string[] = [];
    const options = setup(true);
    options.requestDecision.mockResolvedValue("discard");
    options.discardRecovery.mockImplementation(async () => { order.push("discard"); });
    options.proceed.mockImplementation(async () => { order.push("proceed"); return true; });
    expect(await runDocumentTransition(options)).toBe(true);
    expect(order).toEqual(["proceed", "discard"]);
  });

  test("preserves recovery when a discarded document cannot be opened", async () => {
    const options = setup(true);
    options.requestDecision.mockResolvedValue("discard");
    options.proceed.mockResolvedValue(false);

    expect(await runDocumentTransition(options)).toBe(false);
    expect(options.discardRecovery).not.toHaveBeenCalled();
  });

  test("reports failure without rejecting when recovery cannot be discarded after opening", async () => {
    const options = setup(true);
    options.requestDecision.mockResolvedValue("discard");
    options.discardRecovery.mockRejectedValue(new Error("draft is locked"));

    await expect(runDocumentTransition(options)).resolves.toBe(false);
    expect(options.proceed).toHaveBeenCalledTimes(1);
  });

  test("Cancel preserves the document", async () => {
    const options = setup(true);
    expect(await runDocumentTransition(options)).toBe(false);
    expect(options.save).not.toHaveBeenCalled();
    expect(options.discardRecovery).not.toHaveBeenCalled();
    expect(options.proceed).not.toHaveBeenCalled();
  });
});

function setupApplicationClose(markdownModified: boolean, diagramDirty: boolean) {
  return {
    markdownModified,
    diagramDirty,
    requestDecision: vi.fn<() => Promise<UnsavedDecision>>(async () => "cancel"),
    saveDiagram: vi.fn(async () => true),
    saveMarkdown: vi.fn(async () => true),
    discardMarkdownRecovery: vi.fn(async () => undefined),
    proceed: vi.fn(async () => undefined),
  };
}

describe("runApplicationCloseTransition", () => {
  test("prompts for a dirty Excalidraw diagram and saves it before closing", async () => {
    const options = setupApplicationClose(false, true);
    options.requestDecision.mockResolvedValue("save");

    await expect(runApplicationCloseTransition(options)).resolves.toBe(true);

    expect(options.requestDecision).toHaveBeenCalledTimes(1);
    expect(options.saveDiagram).toHaveBeenCalledTimes(1);
    expect(options.saveMarkdown).not.toHaveBeenCalled();
    expect(options.proceed).toHaveBeenCalledTimes(1);
  });

  test("uses one decision to save both a dirty diagram and Markdown document", async () => {
    const order: string[] = [];
    const options = setupApplicationClose(true, true);
    options.requestDecision.mockResolvedValue("save");
    options.saveDiagram.mockImplementation(async () => { order.push("diagram"); return true; });
    options.saveMarkdown.mockImplementation(async () => { order.push("markdown"); return true; });
    options.proceed.mockImplementation(async () => { order.push("close"); });

    await expect(runApplicationCloseTransition(options)).resolves.toBe(true);

    expect(options.requestDecision).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["diagram", "markdown", "close"]);
  });

  test("does not close when saving the diagram fails", async () => {
    const options = setupApplicationClose(true, true);
    options.requestDecision.mockResolvedValue("save");
    options.saveDiagram.mockResolvedValue(false);

    await expect(runApplicationCloseTransition(options)).resolves.toBe(false);

    expect(options.saveMarkdown).not.toHaveBeenCalled();
    expect(options.proceed).not.toHaveBeenCalled();
  });

  test("discards both dirty resources with one decision", async () => {
    const options = setupApplicationClose(true, true);
    options.requestDecision.mockResolvedValue("discard");

    await expect(runApplicationCloseTransition(options)).resolves.toBe(true);

    expect(options.requestDecision).toHaveBeenCalledTimes(1);
    expect(options.saveDiagram).not.toHaveBeenCalled();
    expect(options.saveMarkdown).not.toHaveBeenCalled();
    expect(options.discardMarkdownRecovery).toHaveBeenCalledTimes(1);
    expect(options.proceed).toHaveBeenCalledTimes(1);
  });

  test("keeps both editors open when closing is canceled", async () => {
    const options = setupApplicationClose(true, true);

    await expect(runApplicationCloseTransition(options)).resolves.toBe(false);

    expect(options.saveDiagram).not.toHaveBeenCalled();
    expect(options.saveMarkdown).not.toHaveBeenCalled();
    expect(options.discardMarkdownRecovery).not.toHaveBeenCalled();
    expect(options.proceed).not.toHaveBeenCalled();
  });
});
