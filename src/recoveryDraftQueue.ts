import type { RecoveryDraft } from "./tauri";

export type { RecoveryDraft } from "./tauri";

type WriteDraft = (draft: RecoveryDraft) => Promise<void>;
type ClearDraft = () => Promise<void>;

export class RecoveryDraftQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writeDraft: WriteDraft,
    private readonly clearDraft: ClearDraft,
  ) {}

  private enqueue(operation: () => Promise<void>) {
    const result = this.tail.catch(() => undefined).then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }

  write(draft: RecoveryDraft) {
    return this.enqueue(() => this.writeDraft(draft));
  }

  clear() {
    return this.enqueue(this.clearDraft);
  }

  drain() {
    return this.tail;
  }
}
