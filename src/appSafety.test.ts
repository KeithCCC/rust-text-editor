import { describe, expect, test, vi } from "vitest";
import {
  DocumentActionGate,
  LatestValue,
  installNativeCloseListener,
  installNativeDragDropListener,
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

describe("installNativeDragDropListener", () => {
  test("shows the drop overlay while an unblocked drag is over the webview", async () => {
    let listener: ((event: { payload: { type: "over" } }) => void) | undefined;
    const setDragOver = vi.fn();
    installNativeDragDropListener(
      async (next) => { listener = next; return vi.fn<() => void>(); },
      () => false,
      () => vi.fn(async () => true),
      setDragOver,
      vi.fn(),
    );
    await Promise.resolve();

    listener?.({ payload: { type: "over" } });

    expect(setDragOver).toHaveBeenCalledWith(true);
  });

  test("hides the drop overlay when the native drag is cancelled", async () => {
    let listener: ((event: { payload: { type: "leave" } }) => void) | undefined;
    const setDragOver = vi.fn();
    installNativeDragDropListener(
      async (next) => { listener = next; return vi.fn<() => void>(); },
      () => false,
      () => vi.fn(async () => true),
      setDragOver,
      vi.fn(),
    );
    await Promise.resolve();

    listener?.({ payload: { type: "leave" } });

    expect(setDragOver).toHaveBeenCalledWith(false);
  });

  test("opens only the first dropped path", async () => {
    let listener: ((event: { payload: { type: "drop"; paths: string[] } }) => void) | undefined;
    const openPath = vi.fn(async () => true);
    installNativeDragDropListener(
      async (next) => { listener = next; return vi.fn<() => void>(); },
      () => false,
      () => openPath,
      vi.fn(),
      vi.fn(),
    );
    await Promise.resolve();

    listener?.({ payload: { type: "drop", paths: ["first.md", "second.md"] } });
    await Promise.resolve();

    expect(openPath).toHaveBeenCalledTimes(1);
    expect(openPath).toHaveBeenCalledWith("first.md");
  });

  test("ignores a drop while document actions are blocked", async () => {
    let listener: ((event: { payload: { type: "drop"; paths: string[] } }) => void) | undefined;
    const openPath = vi.fn(async () => true);
    const setDragOver = vi.fn();
    installNativeDragDropListener(
      async (next) => { listener = next; return vi.fn<() => void>(); },
      () => true,
      () => openPath,
      setDragOver,
      vi.fn(),
    );
    await Promise.resolve();

    listener?.({ payload: { type: "drop", paths: ["blocked.md"] } });
    await Promise.resolve();

    expect(setDragOver).toHaveBeenCalledWith(false);
    expect(openPath).not.toHaveBeenCalled();
  });

  test("dispatches drops through the latest open callback", async () => {
    let listener: ((event: { payload: { type: "drop"; paths: string[] } }) => void) | undefined;
    let openPath = vi.fn(async () => true);
    installNativeDragDropListener(
      async (next) => { listener = next; return vi.fn<() => void>(); },
      () => false,
      () => openPath,
      vi.fn(),
      vi.fn(),
    );
    await Promise.resolve();

    const latestOpenPath = vi.fn(async () => true);
    openPath = latestOpenPath;
    listener?.({ payload: { type: "drop", paths: ["latest.md"] } });
    await Promise.resolve();

    expect(latestOpenPath).toHaveBeenCalledWith("latest.md");
  });

  test("cleans up a listener whose registration finishes after disposal", async () => {
    let finishRegistration!: (unlisten: () => void) => void;
    const unlisten = vi.fn<() => void>();
    const cleanup = installNativeDragDropListener(
      async () => new Promise<() => void>((resolve) => { finishRegistration = resolve; }),
      () => false,
      () => vi.fn(async () => true),
      vi.fn(),
      vi.fn(),
    );

    cleanup();
    finishRegistration(unlisten);
    await vi.waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1));
  });

  test("reports registration and dropped-file callback failures", async () => {
    const registrationError = vi.fn();
    installNativeDragDropListener(
      () => { throw new Error("listener unavailable"); },
      () => false,
      () => vi.fn(async () => true),
      vi.fn(),
      registrationError,
    );
    await Promise.resolve();

    expect(registrationError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "listener unavailable" }),
    );

    let listener: ((event: { payload: { type: "drop"; paths: string[] } }) => void) | undefined;
    const eventError = vi.fn();
    installNativeDragDropListener(
      async (next) => { listener = next; return vi.fn<() => void>(); },
      () => false,
      () => async () => { throw new Error("open failed"); },
      vi.fn(),
      eventError,
    );
    await Promise.resolve();

    listener?.({ payload: { type: "drop", paths: ["broken.md"] } });
    await vi.waitFor(() => {
      expect(eventError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "open failed" }),
      );
    });
  });
});
