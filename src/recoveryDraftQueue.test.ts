import { describe, expect, test, vi } from "vitest";
import { RecoveryDraftQueue, type RecoveryDraft } from "./recoveryDraftQueue";

const draft: RecoveryDraft = {
  schemaVersion: 1,
  documentPath: null,
  content: "draft",
  updatedMs: 42,
};

describe("RecoveryDraftQueue", () => {
  test("clears only after an earlier write completes", async () => {
    const order: string[] = [];
    const queue = new RecoveryDraftQueue(
      async () => { order.push("write"); },
      async () => { order.push("clear"); },
    );
    await Promise.all([queue.write(draft), queue.clear()]);
    expect(order).toEqual(["write", "clear"]);
  });

  test("a failed write does not prevent a later clear", async () => {
    const clear = vi.fn(async () => undefined);
    const queue = new RecoveryDraftQueue(
      async () => { throw new Error("disk full"); },
      clear,
    );
    await expect(queue.write(draft)).rejects.toThrow("disk full");
    await queue.clear();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  test("clear invalidates a scheduled write that fires after clearing begins", async () => {
    const write = vi.fn(async () => undefined);
    const clear = vi.fn(async () => undefined);
    const queue = new RecoveryDraftQueue(write, clear);
    const scheduledWrite = queue.scheduleWrite(draft);

    const clearing = queue.clear();
    await expect(scheduledWrite()).resolves.toBe(false);
    await clearing;

    expect(write).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  test("resume permits new writes without reviving invalidated scheduled writes", async () => {
    const write = vi.fn(async () => undefined);
    const queue = new RecoveryDraftQueue(write, async () => undefined);
    const staleWrite = queue.scheduleWrite(draft);
    await queue.clear();

    queue.resume();
    await expect(staleWrite()).resolves.toBe(false);
    await expect(queue.write({ ...draft, content: "new draft" })).resolves.toBe(true);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ content: "new draft" }));
  });
});
