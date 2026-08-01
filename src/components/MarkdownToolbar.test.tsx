import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  dispatchMenuNavigation,
  dispatchToolbarNavigation,
  focusMenuBoundary,
  restoreMenuTriggerFocus,
  type NavigationControl,
} from "../toolbarNavigation";
import { MarkdownFormatMenu, MarkdownToolbar } from "./MarkdownToolbar";

function navigationControls(states: Array<Partial<Pick<NavigationControl, "disabled" | "hidden">>>) {
  let focused = -1;
  const controls = states.map((state, index): NavigationControl => ({
    disabled: false,
    hidden: false,
    ...state,
    focus: () => {
      focused = index;
    },
  }));
  return { controls, focused: () => focused };
}

function navigationEvent(key: string) {
  return { key, preventDefault: vi.fn() };
}

describe("MarkdownToolbar", () => {
  it("renders three named groups and Heading, List, Code Block, and More menus", () => {
    const html = renderToStaticMarkup(<MarkdownToolbar language="en" onFormat={() => undefined} />);

    expect(html).toContain('role="group" aria-label="Text"');
    expect(html).toContain('role="group" aria-label="Block"');
    expect(html).toContain('role="group" aria-label="Insert"');
    for (const menu of ["Heading", "List", "Code Block", "More"]) {
      expect(html).toContain(`aria-label="${menu}" aria-haspopup="menu"`);
    }
    for (const item of [
      "Heading 1", "Heading 6", "Bullet list", "Numbered list", "Task list",
      "Plain text", "Markdown", "JavaScript", "TypeScript", "JSON", "Rust", "Bash", "PowerShell",
    ]) {
      expect(html).toContain(`aria-label="${item}"`);
    }
  });

  it("uses localized accessible names and explanatory tooltips", () => {
    const html = renderToStaticMarkup(<MarkdownToolbar language="ja" onFormat={() => undefined} />);

    expect(html).toContain('aria-label="Markdown 書式設定"');
    expect(html).toContain('aria-label="文中コード"');
    expect(html).toContain('aria-label="コードブロック" aria-haspopup="menu"');
    expect(html).toContain('title="選択した短いコードを文中コードとして表示します"');
    expect(html).not.toContain("譁・ｸｭ");
  });

  it("exposes shortcuts, known pressed state, and one roving tab stop", () => {
    const html = renderToStaticMarkup(
      <MarkdownToolbar
        language="en"
        formattingContext={{
          headingLevel: null,
          bold: true,
          italic: false,
          strikethrough: false,
          inlineCode: false,
        }}
        onFormat={() => undefined}
      />,
    );

    expect(html).toContain('aria-keyshortcuts="Control+B Meta+B"');
    expect(html).toContain('aria-keyshortcuts="Control+I Meta+I"');
    expect(html).toMatch(/aria-label="Bold"[^>]*aria-pressed="true"/);
    expect((html.match(/tabindex="0"/g) ?? [])).toHaveLength(1);
    expect(html).toContain('tabindex="-1"');
  });

  it("uses radio semantics for heading choices and removes them from ordinary Tab order", () => {
    const html = renderToStaticMarkup(
      <MarkdownToolbar
        language="en"
        formattingContext={{
          headingLevel: 2,
          bold: false,
          italic: false,
          strikethrough: false,
          inlineCode: false,
        }}
        onFormat={() => undefined}
      />,
    );

    expect(html).toMatch(/role="menuitemradio" aria-label="Heading 2"[^>]*aria-checked="true"[^>]*tabindex="-1"/);
    expect(html).not.toMatch(/role="menuitemradio"[^>]*aria-pressed/);
  });

  it("dispatches toolbar navigation with wrapping and skips hidden or disabled controls", () => {
    const { controls, focused } = navigationControls([
      {}, { hidden: true }, { disabled: true }, {}, {},
    ]);
    let current = 0;

    for (const [key, expected] of [
      ["ArrowLeft", 4],
      ["ArrowRight", 0],
      ["End", 4],
      ["Home", 0],
    ] as const) {
      const event = navigationEvent(key);
      current = dispatchToolbarNavigation(event, current, controls) ?? current;
      expect(current).toBe(expected);
      expect(focused()).toBe(expected);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }
  });

  it("dispatches menu arrows, Home, End, and Escape with managed focus", () => {
    const { controls, focused } = navigationControls([{}, { disabled: true }, {}]);
    const escape = vi.fn();
    let current = focusMenuBoundary(controls, "first") ?? -1;
    expect(focused()).toBe(0);

    for (const [key, expected] of [
      ["ArrowDown", 2],
      ["ArrowDown", 0],
      ["ArrowUp", 2],
      ["Home", 0],
      ["End", 2],
    ] as const) {
      const event = navigationEvent(key);
      current = dispatchMenuNavigation(event, current, controls, escape) ?? current;
      expect(current).toBe(expected);
      expect(focused()).toBe(expected);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }

    const escapeEvent = navigationEvent("Escape");
    expect(dispatchMenuNavigation(escapeEvent, current, controls, escape)).toBeNull();
    expect(escapeEvent.preventDefault).toHaveBeenCalledOnce();
    expect(escape).toHaveBeenCalledOnce();
  });

  it("restores trigger focus when Escape or selection closes a menu", () => {
    const close = vi.fn();
    const trigger = { disabled: false, focus: vi.fn() };

    restoreMenuTriggerFocus(trigger, close);

    expect(close).toHaveBeenCalledOnce();
    expect(trigger.focus).toHaveBeenCalledOnce();
  });

  it("disables every control and exposes duplicate narrow-layout actions in More", () => {
    const html = renderToStaticMarkup(<MarkdownToolbar language="en" disabled onFormat={() => undefined} />);

    expect(html).toMatch(/aria-label="Bold"[^>]*disabled=""[^>]*aria-disabled="true"/);
    expect((html.match(/aria-label="Strikethrough"/g) ?? [])).toHaveLength(2);
    expect((html.match(/aria-label="Table"/g) ?? [])).toHaveLength(2);
    expect((html.match(/aria-label="Mermaid diagram"/g) ?? [])).toHaveLength(2);
  });
});

describe("MarkdownFormatMenu", () => {
  it("offers the same localized semantic actions as the toolbar", () => {
    const html = renderToStaticMarkup(
      <MarkdownFormatMenu
        language="ja"
        formatJsonLabel="JSON整形"
        onFormat={() => undefined}
        onFormatJson={() => undefined}
      />,
    );

    for (const label of ["見出し 6", "太字", "チェックリスト", "PowerShell", "表", "図（Mermaid）"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain('aria-keyshortcuts="Control+B Meta+B"');
    expect(html).toContain('aria-label="JSON整形"');
  });
});
