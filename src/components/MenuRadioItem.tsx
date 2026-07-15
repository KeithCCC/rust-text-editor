type MenuRadioItemProps = {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onSelect: () => void;
};

export function MenuRadioItem({ name, value, checked, label, onSelect }: MenuRadioItemProps) {
  return (
    <label className="menu-choice-item" role="menuitemradio" aria-checked={checked}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
      />
      <span>{label}</span>
    </label>
  );
}

type MenuCheckboxItemProps = {
  checked: boolean;
  label: string;
  shortcut?: string;
  onToggle: () => void;
};

export function MenuCheckboxItem({ checked, label, shortcut, onToggle }: MenuCheckboxItemProps) {
  return (
    <label className="menu-choice-item" role="menuitemcheckbox" aria-checked={checked}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
      />
      <span>{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </label>
  );
}
