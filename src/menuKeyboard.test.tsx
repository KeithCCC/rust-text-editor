// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handleMenuKeyDown } from "./menuKeyboard";

let host: HTMLDivElement;
let root: Root;
let frames: FrameRequestCallback[];

function MenuFixture() {
  const [active, setActive] = useState<string | null>(null);
  return <nav onKeyDown={(event) => handleMenuKeyDown(event, setActive)}>
    {["file", "view", "help"].map((id) => <div key={id} className="menu-root" data-menu-id={id} data-open={active === id}>
      <button className="menu-title" onClick={() => setActive(id)}>{id}</button>
      <div className="menu-popover" hidden={active !== id}>
        <button disabled>disabled</button>
        <button data-item={`${id}-first`}>First</button>
        <label><input data-item={`${id}-radio`} type="radio" name={id} />Theme</label>
        <button hidden>hidden</button>
        <button data-item={`${id}-last`}>Last</button>
      </div>
    </div>)}
  </nav>;
}
function item(selector: string) { return host.querySelector<HTMLElement>(selector)!; }
function key(key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  act(() => document.activeElement!.dispatchEvent(event));
  act(() => frames.splice(0).forEach((callback) => callback(0)));
  return event;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<MenuFixture />));
  item('.menu-title').focus();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});
it("opens from the title and traverses buttons and radio inputs without selecting them", () => {
  expect(key("ArrowDown").defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(item('[data-item="file-first"]'));
  key("ArrowDown");
  expect(document.activeElement).toBe(item('[data-item="file-radio"]'));
  expect((document.activeElement as HTMLInputElement).checked).toBe(false);
  key("End");
  expect(document.activeElement).toBe(item('[data-item="file-last"]'));
  key("ArrowDown");
  expect(document.activeElement).toBe(item('[data-item="file-first"]'));
  key("ArrowUp");
  expect(document.activeElement).toBe(item('[data-item="file-last"]'));
  key("Home");
  expect(document.activeElement).toBe(item('[data-item="file-first"]'));
});
it("switches adjacent menus with wrapping and Escape restores the current title", () => {
  key("ArrowUp");
  expect(document.activeElement).toBe(item('[data-item="file-last"]'));
  key("ArrowRight");
  expect(document.activeElement).toBe(item('[data-item="view-first"]'));
  key("ArrowLeft");
  key("ArrowLeft");
  expect(document.activeElement).toBe(item('[data-item="help-first"]'));
  key("Escape");
  expect(document.activeElement).toBe(item('[data-menu-id="help"] .menu-title'));
  expect(host.querySelector('[data-open="true"]')).toBeNull();
});
it("moves between closed menu titles without opening and lets Tab close an open menu", () => {
  key("End");
  expect(document.activeElement).toBe(item('[data-menu-id="help"] .menu-title'));
  key("Home");
  key("ArrowRight");
  expect(document.activeElement).toBe(item('[data-menu-id="view"] .menu-title'));
  expect(host.querySelector('[data-open="true"]')).toBeNull();
  key("ArrowDown");
  expect(key("Tab").defaultPrevented).toBe(false);
  expect(host.querySelector('[data-open="true"]')).toBeNull();
});
