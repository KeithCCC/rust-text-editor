import type { RecoveryDraft } from "./tauri";

export type { RecoveryDraft } from "./tauri";

type WriteDraft = (draft: RecoveryDraft) => Promise<void>;
type ClearDraft = () => Promise<void>;

export class RecoveryDraftQueue {
  private tail: Promise<void> = Promise.resolve();
  private generation = 0;
  private suspended = false;

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
    return this.scheduleWrite(draft)();
  }

  scheduleWrite(draft: RecoveryDraft) {
    const generation = this.generation;
    return () => {
      if (this.suspended || generation !== this.generation) {
        return Promise.resolve(false);
      }
      return this.enqueue(() => this.writeDraft(draft)).then(() => true);
    };
  }

  clear() {
    this.suspended = true;
    this.generation += 1;
    return this.enqueue(this.clearDraft);
  }

  resume() {
    if (!this.suspended) return;
    this.suspended = false;
    this.generation += 1;
  }

  drain() {
    return this.tail;
  }
}
