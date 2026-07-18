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

export type NativeDragDropEvent = {
  payload:
    | { type: "enter" }
    | { type: "over" }
    | { type: "drop"; paths: string[] }
    | { type: "leave" };
};

type OpenDroppedPath = (path: string) => Promise<unknown>;
type RegisterNativeDragDropListener = (
  listener: (event: NativeDragDropEvent) => void,
) => Promise<() => void>;

export function installNativeDragDropListener(
  register: RegisterNativeDragDropListener,
  isActionBlocked: () => boolean,
  getLatestOpenPath: () => OpenDroppedPath,
  setDragOver: (active: boolean) => void,
  reportError: (error: unknown) => void,
) {
  let disposed = false;
  let unlisten: (() => void) | undefined;

  const handleEvent = (event: NativeDragDropEvent) => {
    if (disposed) return;

    try {
      const { payload } = event;
      if (payload.type === "enter" || payload.type === "over") {
        setDragOver(!isActionBlocked());
        return;
      }

      setDragOver(false);
      if (payload.type === "leave" || isActionBlocked()) return;

      const path = payload.paths[0];
      if (!path) return;
      void getLatestOpenPath()(path).catch(reportError);
    } catch (eventError) {
      reportError(eventError);
    }
  };

  let registration: Promise<() => void>;
  try {
    registration = register(handleEvent);
  } catch (registrationError) {
    reportError(registrationError);
    return () => { disposed = true; };
  }

  void registration.then((handler) => {
    if (disposed) handler();
    else unlisten = handler;
  }, reportError);

  return () => {
    disposed = true;
    unlisten?.();
  };
}
