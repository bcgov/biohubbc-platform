import type { MenuItemProps } from '@mui/material/MenuItem';

export interface IDropdownMenuItem {
  value: string;
  label: string;
  iconPath?: string;
  sx?: MenuItemProps['sx'];
  disabled?: boolean;
  onClick?: () => void;
}

export interface IDropdownMenuItemGroup {
  groupId: string;
  items: IDropdownMenuItem[];
}

export interface IDropdownMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  value: string | null;
  itemGroups: IDropdownMenuItemGroup[];
  onClose: () => void;
  onSelect: (value: string) => void;
}
