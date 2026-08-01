import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AppLanguage } from "../appLanguage";
import { getFormattingUi, type FormattingUi } from "../formattingUi";
import type {
  CodeLanguage,
  FormattingContext,
  HeadingLevel,
  MarkdownCommand,
} from "../markdownFormatting";
import {
  dispatchMenuNavigation,
  dispatchToolbarNavigation,
  focusMenuBoundary,
  restoreMenuTriggerFocus,
  type NavigationControl,
} from "../toolbarNavigation";

type FormattingControlProps = {
  language: AppLanguage;
  disabled?: boolean;
  onFormat: (command: MarkdownCommand) => void;
};

type MarkdownToolbarProps = FormattingControlProps & {
  disabledReason?: "documentSafety" | "preview";
  formattingContext?: FormattingContext;
};

type MarkdownFormatMenuProps = FormattingControlProps & {
  formatJsonLabel: string;
  formattingContext?: FormattingContext;
  onFormatJson: () => void;
};

type MenuId = "heading" | "list" | "code" | "more";

type CommandItem = {
  key: string;
  command: MarkdownCommand;
};

const HEADING_ITEMS: CommandItem[] = ([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((level) => ({
  key: `heading${level}`,
  command: { kind: "heading", level },
}));

const LIST_ITEMS: CommandItem[] = [
  { key: "bulletList", command: { kind: "bulletList" } },
  { key: "numberedList", command: { kind: "numberedList" } },
  { key: "taskList", command: { kind: "taskList" } },
];

const CODE_ITEMS: Array<CommandItem & { command: { kind: "codeBlock"; language: CodeLanguage } }> = [
  { key: "codePlain", command: { kind: "codeBlock", language: "" } },
  { key: "codeMarkdown", command: { kind: "codeBlock", language: "markdown" } },
  { key: "codeJavaScript", command: { kind: "codeBlock", language: "javascript" } },
  { key: "codeTypeScript", command: { kind: "codeBlock", language: "typescript" } },
  { key: "codeJson", command: { kind: "codeBlock", language: "json" } },
  { key: "codeRust", command: { kind: "codeBlock", language: "rust" } },
  { key: "codeBash", command: { kind: "codeBlock", language: "bash" } },
  { key: "codePowerShell", command: { kind: "codeBlock", language: "powershell" } },
];

const MORE_ITEMS: CommandItem[] = [
  { key: "strikethrough", command: { kind: "strikethrough" } },
  { key: "table", command: { kind: "table" } },
  { key: "mermaid", command: { kind: "mermaid" } },
];

const FORMAT_MENU_ITEMS: CommandItem[] = [
  ...HEADING_ITEMS,
  { key: "bold", command: { kind: "bold" } },
  { key: "italic", command: { kind: "italic" } },
  { key: "strikethrough", command: { kind: "strikethrough" } },
  { key: "link", command: { kind: "link" } },
  { key: "inlineCode", command: { kind: "inlineCode" } },
  { key: "quote", command: { kind: "quote" } },
  ...LIST_ITEMS,
  ...CODE_ITEMS,
  { key: "table", command: { kind: "table" } },
  { key: "mermaid", command: { kind: "mermaid" } },
];

const SHORTCUTS: Partial<Record<MarkdownCommand["kind"], string>> = {
  bold: "Control+B Meta+B",
  italic: "Control+I Meta+I",
};

const TOOLBAR_CONTROL_COUNT = 12;

const DISABLED_REASON_TEXT = {
  en: {
    documentSafety: "Formatting is unavailable while Koharu is safely processing the document.",
    preview: "Formatting is unavailable in Preview. Switch to Edit or Split to make changes.",
  },
  ja: {
    documentSafety: "文書を安全に処理している間は書式設定を使用できません。",
    preview: "プレビュー表示では書式設定を使用できません。編集または分割表示に切り替えてください。",
  },
} as const;

function navigationControls(
  elements: readonly (HTMLButtonElement | null)[],
  count = elements.length,
): NavigationControl[] {
  return Array.from({ length: count }, (_, index) => {
    const element = elements[index];
    return {
      disabled: !element || element.disabled,
      hidden: !element || element.offsetParent === null,
      focus: () => element?.focus(),
    };
  });
}

function MenuItems({
  items,
  ui,
  disabled,
  formattingContext,
  managed = false,
  registerItem,
  onSelect,
}: {
  items: CommandItem[];
  ui: FormattingUi;
  disabled: boolean;
  formattingContext?: FormattingContext;
  managed?: boolean;
  registerItem?: (index: number, element: HTMLButtonElement | null) => void;
  onSelect: (command: MarkdownCommand) => void;
}) {
  return items.map(({ key, command }, index) => {
    const action = ui.actions[key];
    const isHeading = command.kind === "heading";
    const isCurrentHeading = isHeading
      ? formattingContext?.headingLevel === command.level
      : undefined;
    return (
      <button
        ref={managed ? (element) => registerItem?.(index, element) : undefined}
        key={`${key}-${command.kind === "codeBlock" ? command.language : ""}`}
        type="button"
        role={isHeading ? "menuitemradio" : "menuitem"}
        aria-label={action.label}
        aria-checked={isHeading ? isCurrentHeading : undefined}
        title={action.tooltip}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-keyshortcuts={SHORTCUTS[command.kind]}
        tabIndex={managed ? -1 : undefined}
        onClick={() => onSelect(command)}
      >
        {action.label}
      </button>
    );
  });
}

export function MarkdownFormatMenu({
  language,
  disabled = false,
  formatJsonLabel,
  formattingContext,
  onFormat,
  onFormatJson,
}: MarkdownFormatMenuProps) {
  const ui = getFormattingUi(language);
  return (
    <>
      <MenuItems
        items={FORMAT_MENU_ITEMS}
        ui={ui}
        disabled={disabled}
        formattingContext={formattingContext}
        onSelect={onFormat}
      />
      <div className="menu-separator" role="separator" />
      <button
        type="button"
        role="menuitem"
        aria-label={formatJsonLabel}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        onClick={onFormatJson}
      >
        {formatJsonLabel}
      </button>
    </>
  );
}

export function MarkdownToolbar({
  language,
  disabled = false,
  disabledReason,
  formattingContext,
  onFormat,
}: MarkdownToolbarProps) {
  const ui = getFormattingUi(language);
  const disabledReasonId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const controlRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuItemRefs = useRef<Record<MenuId, Array<HTMLButtonElement | null>>>({
    heading: [],
    list: [],
    code: [],
    more: [],
  });

  useEffect(() => {
    let frame: number | null = null;
    const synchronizeVisibleTabStop = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const controls = controlRefs.current;
        const isAvailable = (index: number) => {
          const control = controls[index];
          return Boolean(control && !control.disabled && control.offsetParent !== null);
        };
        if (isAvailable(activeIndex)) return;

        const nextIndex = isAvailable(11)
          ? 11
          : controls.findIndex((_control, index) => isAvailable(index));
        if (nextIndex < 0) return;

        const toolbarHasFocus = toolbarRef.current?.contains(document.activeElement) ?? false;
        setActiveIndex(nextIndex);
        if (openMenu !== null && !isAvailable(activeIndex)) setOpenMenu(null);
        if (toolbarHasFocus) controls[nextIndex]?.focus();
      });
    };

    window.addEventListener("resize", synchronizeVisibleTabStop);
    return () => {
      window.removeEventListener("resize", synchronizeVisibleTabStop);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [activeIndex, openMenu]);

  useEffect(() => {
    if (disabled) setOpenMenu(null);
  }, [disabled]);

  useEffect(() => {
    if (openMenu === null) return;
    const dismissOutsideToolbar = (event: Event) => {
      if (!(event.target instanceof Node) || toolbarRef.current?.contains(event.target)) return;
      setOpenMenu(null);
    };
    document.addEventListener("pointerdown", dismissOutsideToolbar, true);
    document.addEventListener("focusin", dismissOutsideToolbar, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutsideToolbar, true);
      document.removeEventListener("focusin", dismissOutsideToolbar, true);
    };
  }, [openMenu]);

  const runCommand = (command: MarkdownCommand) => {
    onFormat(command);
  };

  const closeMenu = (triggerIndex: number) => {
    restoreMenuTriggerFocus(controlRefs.current[triggerIndex], () => setOpenMenu(null));
  };

  const focusMenu = (id: MenuId, boundary: "first" | "last") => {
    window.requestAnimationFrame(() => {
      focusMenuBoundary(navigationControls(menuItemRefs.current[id]), boundary);
    });
  };

  const openAndFocusMenu = (id: MenuId, boundary: "first" | "last" = "first") => {
    setOpenMenu(id);
    focusMenu(id, boundary);
  };

  const runMenuCommand = (triggerIndex: number, command: MarkdownCommand) => {
    onFormat(command);
    restoreMenuTriggerFocus(controlRefs.current[triggerIndex], () => setOpenMenu(null));
  };

  const controlProps = (index: number) => ({
    ref: (element: HTMLButtonElement | null) => {
      controlRefs.current[index] = element;
    },
    "data-toolbar-control": "true",
    "data-toolbar-index": String(index),
    tabIndex: !disabled && index === activeIndex ? 0 : -1,
    onFocus: () => setActiveIndex(index),
  });

  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab" && openMenu !== null) {
      setOpenMenu(null);
      return;
    }
    if (!(event.target instanceof HTMLButtonElement) || event.target.dataset.toolbarControl !== "true") {
      return;
    }
    const nextIndex = dispatchToolbarNavigation(
      event,
      Number(event.target.dataset.toolbarIndex),
      navigationControls(controlRefs.current, TOOLBAR_CONTROL_COUNT),
    );
    if (nextIndex !== null) setActiveIndex(nextIndex);
  };

  const actionButton = (
    index: number,
    key: string,
    command: MarkdownCommand,
    options: { className?: string; pressed?: boolean } = {},
  ) => {
    const action = ui.actions[key];
    return (
      <button
        {...controlProps(index)}
        key={key}
        type="button"
        className={options.className}
        aria-label={action.label}
        title={action.tooltip}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-pressed={formattingContext ? options.pressed : undefined}
        aria-keyshortcuts={SHORTCUTS[command.kind]}
        onClick={() => runCommand(command)}
      >
        {action.short}
      </button>
    );
  };

  const menu = (
    index: number,
    id: MenuId,
    key: string,
    items: CommandItem[],
    options: { className?: string; pressed?: boolean } = {},
  ) => {
    const action = ui.actions[key];
    const isOpen = openMenu === id;
    const toggleMenu = () => {
      if (isOpen) {
        closeMenu(index);
      } else {
        openAndFocusMenu(id);
      }
    };
    const handleMenuTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        openAndFocusMenu(id, event.key === "ArrowUp" ? "last" : "first");
      } else if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeMenu(index);
      }
    };
    const handleMenuItemsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (!(event.target instanceof HTMLButtonElement)) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Escape"].includes(event.key)) {
        return;
      }
      event.stopPropagation();
      dispatchMenuNavigation(
        event,
        menuItemRefs.current[id].indexOf(event.target),
        navigationControls(menuItemRefs.current[id]),
        () => closeMenu(index),
      );
    };
    return (
      <div
        className={`toolbar-menu-root${options.className ? ` ${options.className}` : ""}`}
        data-open={isOpen}
        data-menu-placement={id === "more" ? "end" : undefined}
      >
        <button
          {...controlProps(index)}
          type="button"
          aria-label={action.label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title={action.tooltip}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          aria-pressed={formattingContext ? options.pressed : undefined}
          onClick={toggleMenu}
          onKeyDown={handleMenuTriggerKeyDown}
        >
          {action.short}<span aria-hidden="true"> ▾</span>
        </button>
        <div
          className="toolbar-menu-popover"
          role="menu"
          aria-label={action.label}
          onKeyDown={handleMenuItemsKeyDown}
        >
          <MenuItems
            items={items}
            ui={ui}
            disabled={disabled}
            formattingContext={formattingContext}
            managed
            registerItem={(itemIndex, element) => {
              menuItemRefs.current[id][itemIndex] = element;
            }}
            onSelect={(command) => runMenuCommand(index, command)}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={toolbarRef}
      className="markdown-toolbar"
      role="toolbar"
      aria-label={ui.toolbarLabel}
      aria-disabled={disabled || undefined}
      aria-describedby={disabled && disabledReason ? disabledReasonId : undefined}
      onKeyDown={handleToolbarKeyDown}
    >
      {disabled && disabledReason && (
        <p id={disabledReasonId} className="toolbar-disabled-status" role="status" tabIndex={0}>
          {DISABLED_REASON_TEXT[language][disabledReason]}
        </p>
      )}
      <ToolbarGroup label={ui.groups.text}>
        {menu(0, "heading", "heading", HEADING_ITEMS, {
          pressed: formattingContext?.headingLevel !== null,
        })}
        {actionButton(1, "bold", { kind: "bold" }, { pressed: formattingContext?.bold })}
        {actionButton(2, "italic", { kind: "italic" }, { pressed: formattingContext?.italic })}
        {actionButton(3, "strikethrough", { kind: "strikethrough" }, {
          className: "toolbar-wide-action",
          pressed: formattingContext?.strikethrough,
        })}
        {actionButton(4, "link", { kind: "link" })}
        {actionButton(5, "inlineCode", { kind: "inlineCode" }, { pressed: formattingContext?.inlineCode })}
      </ToolbarGroup>
      <ToolbarGroup label={ui.groups.block}>
        {actionButton(6, "quote", { kind: "quote" })}
        {menu(7, "list", "list", LIST_ITEMS)}
        {menu(8, "code", "codeBlock", CODE_ITEMS)}
      </ToolbarGroup>
      <ToolbarGroup label={ui.groups.insert}>
        {actionButton(9, "table", { kind: "table" }, { className: "toolbar-wide-action" })}
        {actionButton(10, "mermaid", { kind: "mermaid" }, { className: "toolbar-wide-action" })}
        {menu(11, "more", "more", MORE_ITEMS, { className: "toolbar-more-menu" })}
      </ToolbarGroup>
    </div>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="markdown-toolbar-group" role="group" aria-label={label}>
      {children}
    </div>
  );
}
