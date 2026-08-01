export type UnsavedDecision = "save" | "discard" | "cancel";

export type DocumentTransitionOptions = {
  modified: boolean;
  requestDecision: () => Promise<UnsavedDecision>;
  save: () => Promise<boolean>;
  discardRecovery: () => Promise<void>;
  proceed: () => Promise<boolean>;
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
    const proceeded = await proceed();
    if (!proceeded) return false;

    if (decision === "discard") {
      try {
        await discardRecovery();
      } catch {
        return true;
      }
    }

    return true;
  }

  return proceed();
}

export type ApplicationCloseTransitionOptions = {
  markdownModified: boolean;
  diagramDirty: boolean;
  requestDecision: () => Promise<UnsavedDecision>;
  saveDiagram: () => Promise<boolean>;
  saveMarkdown: () => Promise<boolean>;
  discardMarkdownRecovery: () => Promise<void>;
  proceed: () => Promise<void>;
};

export async function runApplicationCloseTransition({
  markdownModified,
  diagramDirty,
  requestDecision,
  saveDiagram,
  saveMarkdown,
  discardMarkdownRecovery,
  proceed,
}: ApplicationCloseTransitionOptions): Promise<boolean> {
  if (markdownModified || diagramDirty) {
    const decision = await requestDecision();
    if (decision === "cancel") return false;

    if (decision === "save") {
      if (diagramDirty && !(await saveDiagram())) return false;
      if (markdownModified && !(await saveMarkdown())) return false;
    }

    if (decision === "discard" && markdownModified) {
      try {
        await discardMarkdownRecovery();
      } catch {
        return false;
      }
    }
  }

  await proceed();
  return true;
}
