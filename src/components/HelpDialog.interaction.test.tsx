// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HelpDialog } from "./HelpDialog";

let container: HTMLDivElement;
let root: Root;

function HelpHarness() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>Open help</button>
      <button type="button">Background action</button>
      {isOpen && <HelpDialog language="en" onClose={() => setIsOpen(false)} />}
    </div>
  );
}

function button(text: string) {
  const match = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent === text || candidate.getAttribute("aria-label") === text);
  if (!match) throw new Error(`Button not found: ${text}`);
  return match;
}

function click(target: HTMLElement) {
  act(() => target.click());
}

function focus(target: HTMLElement) {
  act(() => target.focus());
}

function keyDown(target: HTMLElement, key: string, shiftKey = false) {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  act(() => target.dispatchEvent(event));
  return event;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<HelpHarness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("HelpDialog rendered focus behavior", () => {
  it("moves initial focus into the dialog and makes background controls inert", () => {
    const invoker = button("Open help");
    focus(invoker);

    click(invoker);

    expect(document.activeElement).toBe(button("Close How to use Koharu"));
    expect(invoker.hasAttribute("inert")).toBe(true);
    expect(button("Background action").hasAttribute("inert")).toBe(true);
  });

  it("contains forward, reverse, and programmatic focus within the dialog", () => {
    const invoker = button("Open help");
    focus(invoker);
    click(invoker);
    const first = button("Close How to use Koharu");
    const last = button("Close");

    focus(last);
    expect(keyDown(last, "Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    expect(keyDown(first, "Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    focus(button("Background action"));
    expect(document.activeElement).toBe(first);
  });

  it("closes on Escape, removes background inertness, and restores the invoker", () => {
    const invoker = button("Open help");
    focus(invoker);
    click(invoker);
    const close = button("Close How to use Koharu");

    const event = keyDown(close, "Escape");

    expect(event.defaultPrevented).toBe(true);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(invoker.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(invoker);
  });
});
