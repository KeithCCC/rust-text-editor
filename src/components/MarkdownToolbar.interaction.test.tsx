// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownToolbar } from "./MarkdownToolbar";

let container: HTMLDivElement;
let root: Root;
let animationFrames: FrameRequestCallback[];
let originalAnimationFrame: typeof window.requestAnimationFrame;

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.getAttribute("aria-label") === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function patchLayout() {
  for (const control of container.querySelectorAll<HTMLButtonElement>("button")) {
    Object.defineProperty(control, "offsetParent", {
      configurable: true,
      get: () => control.hidden ? null : control.parentElement,
    });
  }
}

function keyDown(target: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function click(target: HTMLElement) {
  act(() => {
    target.click();
  });
}

function focus(target: HTMLElement) {
  act(() => {
    target.focus();
  });
}

function flushAnimationFrame() {
  act(() => {
    const callbacks = animationFrames.splice(0);
    for (const callback of callbacks) callback(performance.now());
  });
}

function resizeViewport() {
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
  flushAnimationFrame();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  animationFrames = [];
  originalAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.requestAnimationFrame = originalAnimationFrame;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  vi.restoreAllMocks();
});

describe("MarkdownToolbar rendered interaction", () => {
  it("dispatches Left, Right, Home, and End through the toolbar handler", () => {
    act(() => {
      root.render(<MarkdownToolbar language="en" onFormat={() => undefined} />);
    });
    patchLayout();
    const heading = button("Heading");
    const more = button("More");
    focus(heading);

    for (const [key, expected] of [
      ["ArrowLeft", more],
      ["ArrowRight", heading],
      ["End", more],
      ["Home", heading],
    ] as const) {
      const event = keyDown(document.activeElement as HTMLElement, key);
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(expected);
    }
  });

  it("skips controls hidden or disabled in the rendered toolbar", () => {
    act(() => {
      root.render(<MarkdownToolbar language="en" onFormat={() => undefined} />);
    });
    patchLayout();
    const bold = button("Bold");
    button("Italic").disabled = true;
    button("Strikethrough").hidden = true;
    focus(bold);

    const event = keyDown(bold, "ArrowRight");

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Link"));
  });

  it("moves the roving tab stop and focus to More when the active direct action becomes hidden", () => {
    act(() => {
      root.render(<MarkdownToolbar language="en" onFormat={() => undefined} />);
    });
    patchLayout();
    const strikethrough = button("Strikethrough");
    const more = button("More");
    focus(strikethrough);
    expect(strikethrough.tabIndex).toBe(0);

    strikethrough.hidden = true;
    resizeViewport();

    expect(strikethrough.tabIndex).toBe(-1);
    expect(more.tabIndex).toBe(0);
    expect(document.activeElement).toBe(more);
  });

  it("updates a hidden roving tab stop without stealing focus from outside the toolbar", () => {
    act(() => {
      root.render(<MarkdownToolbar language="en" onFormat={() => undefined} />);
    });
    patchLayout();
    const strikethrough = button("Strikethrough");
    const more = button("More");
    const outside = document.createElement("button");
    document.body.append(outside);
    focus(strikethrough);
    focus(outside);

    strikethrough.hidden = true;
    resizeViewport();

    expect(more.tabIndex).toBe(0);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("opens a real menu, manages item keys, and restores trigger focus", () => {
    const onFormat = vi.fn();
    act(() => {
      root.render(<MarkdownToolbar language="en" onFormat={onFormat} />);
    });
    patchLayout();
    const heading = button("Heading");
    focus(heading);

    const openEvent = keyDown(heading, "ArrowDown");
    expect(openEvent.defaultPrevented).toBe(true);
    expect(heading.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(heading);
    flushAnimationFrame();
    expect(document.activeElement).toBe(button("Heading 1"));

    expect(keyDown(button("Heading 1"), "ArrowDown").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Heading 2"));
    expect(keyDown(button("Heading 2"), "End").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Heading 6"));
    expect(keyDown(button("Heading 6"), "Home").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button("Heading 1"));

    expect(keyDown(button("Heading 1"), "Escape").defaultPrevented).toBe(true);
    expect(heading.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(heading);

    click(heading);
    flushAnimationFrame();
    click(button("Heading 2"));
    expect(onFormat).toHaveBeenLastCalledWith({ kind: "heading", level: 2 });
    expect(heading.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(heading);
  });
});
