export class DocumentActionGate {
  private readonly blockers: Set<string>;

  constructor(initialBlockers: readonly string[] = []) {
    this.blockers = new Set(initialBlockers);
  }

  block(reason: string) {
    this.blockers.add(reason);
  }

  release(reason: string) {
    this.blockers.delete(reason);
  }

  isBlocked() {
    return this.blockers.size > 0;
  }
}

export async function runExclusiveDocumentAction<T>(
  gate: DocumentActionGate,
  reason: string,
  action: () => Promise<T>,
  setActive: (active: boolean) => void = () => undefined,
) {
  if (gate.isBlocked()) return undefined;
  gate.block(reason);
  try {
    setActive(true);
    return await action();
  } finally {
    gate.release(reason);
    setActive(false);
  }
}

export class LatestValue<T> {
  constructor(private value: T) {}

  set(value: T) {
    this.value = value;
  }

  get() {
    return this.value;
  }
}

export async function resolveStartupRecoveryChoice(
  recover: boolean,
  restore: () => void,
  discard: () => Promise<void>,
  dismiss: () => void,
) {
  if (recover) {
    restore();
  } else {
    try {
      await discard();
    } catch {
      return false;
    }
  }
  dismiss();
  return true;
}

export async function runCloseRequestSafely<T>(
  requestClose: () => Promise<T>,
  reportError: (error: unknown) => void,
) {
  try {
    return await requestClose();
  } catch (closeError) {
    reportError(closeError);
    return false;
  }
}

export async function runSaveOperationSafely(
  saveOperation: () => Promise<boolean>,
  reportError: (error: unknown) => void,
) {
  try {
    return await saveOperation();
  } catch (saveError) {
    reportError(saveError);
    return false;
  }
}

type CloseEvent = {
  preventDefault: () => void;
};

type CloseRequest = () => Promise<unknown>;
type RegisterCloseListener = (
  listener: (event: CloseEvent) => void,
) => Promise<() => void>;

export function installNativeCloseListener(
  register: RegisterCloseListener,
  getLatestCloseRequest: () => CloseRequest,
  reportError: (error: unknown) => void,
) {
  let disposed = false;
  let unlisten: (() => void) | undefined;

  void register((event) => {
    event.preventDefault();
    void getLatestCloseRequest()().catch(reportError);
  }).then((handler) => {
    if (disposed) handler();
    else unlisten = handler;
  }, reportError);

  return () => {
    disposed = true;
    unlisten?.();
  };
}
