import { describe, expect, test, vi } from "vitest";
import {
  DocumentActionGate,
  LatestValue,
  installNativeCloseListener,
  resolveStartupRecoveryChoice,
  runCloseRequestSafely,
  runExclusiveDocumentAction,
  runSaveOperationSafely,
} from "./appSafety";

test("LatestValue supplies the newest snapshot to a deferred operation", async () => {
  const latest = new LatestValue({ content: "old" });
  const deferredRead = async () => latest.get().content;

  latest.set({ content: "new" });

  await expect(deferredRead()).resolves.toBe("new");
});

test("runCloseRequestSafely reports failure and resolves false", async () => {
  const reportError = vi.fn();

  await expect(runCloseRequestSafely(
    async () => { throw new Error("exit failed"); },
    reportError,
  )).resolves.toBe(false);

  expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "exit failed" }));
});

test("runExclusiveDocumentAction blocks edits until a deferred save completes", async () => {
  const gate = new DocumentActionGate();
  const activeStates: boolean[] = [];
  let finishWrite!: () => void;
  const document = { content: "saved snapshot", modified: true };
  const saving = runExclusiveDocumentAction(
    gate,
    "direct-save",
    async () => {
      await new Promise<void>((resolve) => { finishWrite = resolve; });
      document.modified = false;
      return true;
    },
    (active) => activeStates.push(active),
  );

  if (!gate.isBlocked()) {
    document.content = "new edit";
    document.modified = true;
  }
  expect(document).toEqual({ content: "saved snapshot", modified: true });

  finishWrite();
  await expect(saving).resolves.toBe(true);
  expect(document).toEqual({ content: "saved snapshot", modified: false });
  expect(gate.isBlocked()).toBe(false);
  expect(activeStates).toEqual([true, false]);
});

test("runExclusiveDocumentAction rejects a competing action during link preflight", async () => {
  const gate = new DocumentActionGate();
  let finishResolution!: () => void;
  const resolving = runExclusiveDocumentAction(gate, "relative-link", async () => {
    await new Promise<void>((resolve) => { finishResolution = resolve; });
    return "resolved.md";
  });
  const competingAction = vi.fn(async () => "other.md");

  await expect(runExclusiveDocumentAction(gate, "other", competingAction)).resolves.toBeUndefined();
  expect(competingAction).not.toHaveBeenCalled();

  finishResolution();
  await expect(resolving).resolves.toBe("resolved.md");
});

test("runSaveOperationSafely reports picker rejection and returns false", async () => {
  const reportError = vi.fn();

  await expect(runSaveOperationSafely(
    async () => { throw new Error("picker unavailable"); },
    reportError,
  )).resolves.toBe(false);

  expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "picker unavailable" }));
});

describe("DocumentActionGate", () => {
  test("remains blocked until every independent safety operation finishes", () => {
    const gate = new DocumentActionGate(["startup"]);

    gate.block("transition");
    gate.release("startup");
    expect(gate.isBlocked()).toBe(true);

    gate.release("transition");
    expect(gate.isBlocked()).toBe(false);
  });
});

describe("resolveStartupRecoveryChoice", () => {
  test("keeps recovery visible until discard completes", async () => {
    let finishDiscard!: () => void;
    const discard = vi.fn(() => new Promise<void>((resolve) => { finishDiscard = resolve; }));
    const dismiss = vi.fn();
    const resolution = resolveStartupRecoveryChoice(false, vi.fn(), discard, dismiss);

    expect(dismiss).not.toHaveBeenCalled();
    finishDiscard();

    await expect(resolution).resolves.toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  test("keeps recovery visible when discard fails", async () => {
    const dismiss = vi.fn();

    await expect(resolveStartupRecoveryChoice(
      false,
      vi.fn(),
      async () => { throw new Error("draft locked"); },
      dismiss,
    )).resolves.toBe(false);

    expect(dismiss).not.toHaveBeenCalled();
  });
});

describe("installNativeCloseListener", () => {
  test("dispatches every close request through the latest callback", async () => {
    let listener: ((event: { preventDefault: () => void }) => void) | undefined;
    let closeRequest = vi.fn(async () => true);
    installNativeCloseListener(
      async (next) => { listener = next; return vi.fn<() => void>(); },
      () => closeRequest,
      vi.fn(),
    );
    await Promise.resolve();

    const latestCloseRequest = vi.fn(async () => true);
    closeRequest = latestCloseRequest;
    const preventDefault = vi.fn();
    listener?.({ preventDefault });
    await Promise.resolve();

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(latestCloseRequest).toHaveBeenCalledTimes(1);
  });

  test("reports a rejected close request and keeps the event prevented", async () => {
    let listener: ((event: { preventDefault: () => void }) => void) | undefined;
    const reportError = vi.fn();
    installNativeCloseListener(
      async (next) => { listener = next; return vi.fn<() => void>(); },
      () => async () => { throw new Error("state save failed"); },
      reportError,
    );
    await Promise.resolve();

    const preventDefault = vi.fn();
    listener?.({ preventDefault });
    await Promise.resolve();
    await Promise.resolve();

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "state save failed" }));
  });

  test("reports listener registration failure", async () => {
    const reportError = vi.fn();
    installNativeCloseListener(
      async () => { throw new Error("listener unavailable"); },
      () => async () => true,
      reportError,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "listener unavailable" }));
  });
});
