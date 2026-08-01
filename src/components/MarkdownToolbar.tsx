import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AppLanguage } from "../appLanguage";
import { getFormattingUi, type FormattingUi } from "../formattingUi";
import type {
  CodeLanguage,
  FormattingContext,
  HeadingLevel,
  MarkdownCommand,
} from "../markdownFormatting";
import { nextToolbarIndex, type ToolbarNavigationKey } from "../toolbarNavigation";

type FormattingControlProps = {
  language: AppLanguage;
  disabled?: boolean;
  onFormat: (command: MarkdownCommand) => void;
};

type MarkdownToolbarProps = FormattingControlProps & {
  formattingContext?: FormattingContext;
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

function MenuItems({
  items,
  ui,
  disabled,
  formattingContext,
  onSelect,
}: {
  items: CommandItem[];
  ui: FormattingUi;
  disabled: boolean;
  formattingContext?: FormattingContext;
  onSelect: (command: MarkdownCommand) => void;
}) {
  return items.map(({ key, command }) => {
    const action = ui.actions[key];
    const isCurrentHeading = command.kind === "heading" && formattingContext
      ? formattingContext.headingLevel === command.level
      : undefined;
    return (
      <button
        key={`${key}-${command.kind === "codeBlock" ? command.language : ""}`}
        type="button"
        role="menuitem"
        aria-label={action.label}
        title={action.tooltip}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-pressed={isCurrentHeading}
        aria-keyshortcuts={SHORTCUTS[command.kind]}
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
  onFormat,
}: FormattingControlProps) {
  const ui = getFormattingUi(language);
  return (
    <>
      <MenuItems
        items={FORMAT_MENU_ITEMS}
        ui={ui}
        disabled={disabled}
        onSelect={onFormat}
      />
    </>
  );
}

export function MarkdownToolbar({
  language,
  disabled = false,
  formattingContext,
  onFormat,
}: MarkdownToolbarProps) {
  const ui = getFormattingUi(language);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const controlRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const runCommand = (command: MarkdownCommand) => {
    setOpenMenu(null);
    onFormat(command);
  };

  const controlProps = (index: number) => ({
    ref: (element: HTMLButtonElement | null) => {
      controlRefs.current[index] = element;
    },
    "data-toolbar-control": "true",
    "data-toolbar-index": String(index),
    tabIndex: index === activeIndex ? 0 : -1,
    onFocus: () => setActiveIndex(index),
  });

  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLButtonElement) || event.target.dataset.toolbarControl !== "true") {
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const visibleControls = controlRefs.current.filter((control): control is HTMLButtonElement => (
      Boolean(control && control.offsetParent !== null && !control.disabled)
    ));
    const visibleIndex = Math.max(0, visibleControls.indexOf(event.target));
    const nextVisibleIndex = nextToolbarIndex(
      visibleIndex,
      visibleControls.length,
      event.key as ToolbarNavigationKey,
    );
    const nextControl = visibleControls[nextVisibleIndex];
    if (!nextControl) return;
    setActiveIndex(Number(nextControl.dataset.toolbarIndex));
    nextControl.focus();
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
    return (
      <div className={`toolbar-menu-root${options.className ? ` ${options.className}` : ""}`} data-open={isOpen}>
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
          onClick={() => setOpenMenu((current) => current === id ? null : id)}
        >
          {action.short}<span aria-hidden="true"> ▾</span>
        </button>
        <div className="toolbar-menu-popover" role="menu" aria-label={action.label}>
          <MenuItems
            items={items}
            ui={ui}
            disabled={disabled}
            formattingContext={formattingContext}
            onSelect={runCommand}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className="markdown-toolbar"
      role="toolbar"
      aria-label={ui.toolbarLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={handleToolbarKeyDown}
    >
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
