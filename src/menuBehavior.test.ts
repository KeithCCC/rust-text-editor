import { describe, expect, test } from "vitest";
import { shouldDismissMenuForPointerTarget } from "./menuBehavior";

describe("shouldDismissMenuForPointerTarget", () => {
  test("dismisses an open menu when the user clicks outside the menubar", () => {
    const editor = {};
    const menubar = {
      contains: (target: Node | null) => target !== editor,
    } as HTMLElement;

    expect(shouldDismissMenuForPointerTarget(menubar, editor as Node)).toBe(true);
  });

  test("keeps an open menu when the user clicks inside the menubar", () => {
    const menuButton = {};
    const menubar = {
      contains: (target: Node | null) => target === menuButton,
    } as HTMLElement;

    expect(shouldDismissMenuForPointerTarget(menubar, menuButton as Node)).toBe(false);
  });
});
