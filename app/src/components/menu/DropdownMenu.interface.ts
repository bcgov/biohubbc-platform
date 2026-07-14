export interface IDropdownMenuItem {
  value: string;
  label: string;
  iconPath: string;
  disabled?: boolean;
}

export interface IDropdownMenuItemGroup {
  groupId: string;
  items: IDropdownMenuItem[];
}

export interface IDropdownMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  value: string;
  itemGroups: IDropdownMenuItemGroup[];
  onClose: () => void;
  onSelect: (value: string) => void;
}
