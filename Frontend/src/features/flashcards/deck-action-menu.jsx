import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "../../components/ui/ui.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";

export default function DeckActionMenu({
  label,
  items,
  disabled = false,
  icon = "more",
  selectedKey,
  quiet = false,
}) {
  useLocale();
  return (
    <Dropdown
      disableAnimation
      placement="bottom-end"
      classNames={{ content: "flash-actions-menu" }}
    >
      <DropdownTrigger>
        <button
          type="button"
          className={`flash-item-menu-trigger ${quiet ? "flash-folder-action" : "btn"}`}
          disabled={disabled}
          title={label}
          aria-label={label}
        >
          <Icon name={icon} size={quiet ? 16 : 18} />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={label}
        {...(selectedKey
          ? { selectionMode: "single", selectedKeys: [selectedKey] }
          : {})}
        disabledKeys={items
          .filter((item) => item.disabled)
          .map((item) => item.key)}
        onAction={(key) => items.find((item) => item.key === key)?.run()}
      >
        {items.map((item) => (
          <DropdownItem
            key={item.key}
            textValue={tr(item.label)}
            startContent={<Icon name={item.icon} size={18} />}
            className={item.danger ? "flash-menu-danger" : ""}
            showDivider={item.divider}
          >
            {tr(item.label)}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
