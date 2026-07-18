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
});
