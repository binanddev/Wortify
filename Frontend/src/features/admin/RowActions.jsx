import {Dropdown, DropdownTrigger, DropdownMenu, DropdownItem} from "@heroui/react";

// Portalled menus keep table geometry fixed and remain visible near scroll edges.
export default function RowActions({label, items}) {
  return <Dropdown disableAnimation placement="bottom-end" classNames={{content:"admin-menu-surface"}}>
    <DropdownTrigger><button type="button" className="admin-action-trigger" aria-label={label} title={label}>⋮</button></DropdownTrigger>
    <DropdownMenu aria-label={label} disabledKeys={items.filter(item=>item.disabled).map(item=>item.key)} onAction={key=>items.find(item=>item.key===key)?.run()}>
      {items.map(item=><DropdownItem key={item.key} className={item.danger?"admin-menu-item admin-menu-danger":"admin-menu-item"}>{item.label}</DropdownItem>)}
    </DropdownMenu>
  </Dropdown>;
}
