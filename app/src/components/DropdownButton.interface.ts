import type { ButtonProps } from '@mui/material/Button';

export interface IDropdownButtonItem {
  value: string;
  label: string;
  iconPath: string;
  disabled?: boolean;
}

export interface IDropdownButtonItemGroup {
  groupId: string;
  items: IDropdownButtonItem[];
}

export interface IDropdownButtonProps extends Omit<
  ButtonProps,
  'children' | 'onClick' | 'onSelect' | 'value' | 'className'
> {
  value: string;
  itemGroups: IDropdownButtonItemGroup[];
  onSelect: (value: string) => void;
}

export interface IDropdownButtonGroupProps extends Omit<
  ButtonProps,
  'children' | 'onClick' | 'onSelect' | 'value' | 'className'
> {
  value: string;
  itemGroups: IDropdownButtonItemGroup[];
  onSelect: (value: string) => void;
  primaryLabel?: string;
  onPrimaryClick?: () => void;
}
