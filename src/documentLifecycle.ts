export type UnsavedDecision = "save" | "discard" | "cancel";

export type DocumentTransitionOptions = {
  modified: boolean;
  requestDecision: () => Promise<UnsavedDecision>;
  save: () => Promise<boolean>;
  discardRecovery: () => Promise<void>;
  proceed: () => Promise<void>;
};

export async function runDocumentTransition({
  modified,
  requestDecision,
  save,
  discardRecovery,
  proceed,
}: DocumentTransitionOptions): Promise<boolean> {
  if (modified) {
    const decision = await requestDecision();
    if (decision === "cancel") {
      return false;
    }
    if (decision === "save" && !(await save())) {
      return false;
    }
    if (decision === "discard") {
      try {
        await discardRecovery();
      } catch {
        return false;
      }
    }
  }

  await proceed();
  return true;
}
