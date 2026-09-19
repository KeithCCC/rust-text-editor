import type { KeyboardEvent } from "react";

function available(element: HTMLElement, boundary: HTMLElement): boolean {
  if (element.matches(":disabled, [aria-disabled='true']")) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (current === boundary) break;
  }
  return true;
}

function menuItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".menu-popover button, .menu-popover input"))
    .filter((item) => available(item, root));
}

/** Attach to the menubar; each .menu-root must have its stable data-menu-id. */
export function handleMenuKeyDown<MenuId extends string>(
  event: KeyboardEvent<HTMLElement>,
  openMenu: (id: MenuId | null) => void,
): void {
  if (!(event.target instanceof HTMLElement)) return;
  const currentRoot = event.target.closest<HTMLElement>(".menu-root[data-menu-id]");
  if (!currentRoot || !event.currentTarget.contains(currentRoot)) return;
  const title = currentRoot.querySelector<HTMLButtonElement>(".menu-title");
  const onTitle = event.target === title;
  const isOpen = currentRoot.dataset.open === "true";
  const roots = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".menu-root[data-menu-id]"))
    .filter((root) => {
      const trigger = root.querySelector<HTMLElement>(".menu-title");
      return trigger && available(trigger, root);
    });
  const openAndFocus = (root: HTMLElement, last = false) => {
    openMenu(root.dataset.menuId as MenuId);
    // React must render the newly opened popover before testing visibility.
    requestAnimationFrame(() => {
      if (!root.isConnected || root.dataset.open !== "true") return;
      const items = menuItems(root);
      (items[last ? items.length - 1 : 0] ?? root.querySelector<HTMLElement>(".menu-title"))?.focus();
    });
  };

  if (event.key === "Tab") {
    openMenu(null);
    return;
  }
  if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") {
    openMenu(null);
    title?.focus();
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = roots[(roots.indexOf(currentRoot) + direction + roots.length) % roots.length];
    if (!next) return;
    if (isOpen || !onTitle) openAndFocus(next);
    else next.querySelector<HTMLElement>(".menu-title")?.focus();
    return;
  }
  if (onTitle) {
    if (event.key === "Home" || event.key === "End") {
      const next = roots[event.key === "End" ? roots.length - 1 : 0];
      if (next && isOpen) openAndFocus(next);
      else next?.querySelector<HTMLElement>(".menu-title")?.focus();
    } else openAndFocus(currentRoot, event.key === "ArrowUp");
    return;
  }
  const items = menuItems(currentRoot);
  const currentIndex = items.indexOf(event.target);
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
    : (currentIndex + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
  items[nextIndex]?.focus();
}
