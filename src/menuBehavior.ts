export function shouldDismissMenuForPointerTarget(menubar: HTMLElement | null, target: EventTarget | null) {
  return target !== null && !menubar?.contains(target as Node);
}
