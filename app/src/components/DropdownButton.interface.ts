import type { ButtonProps } from '@mui/material/Button';
import type { IDropdownMenuItemGroup } from './menu/DropdownMenu.interface';

export interface IDropdownButtonProps extends Omit<
  ButtonProps,
  'children' | 'onClick' | 'onSelect' | 'value' | 'className'
> {
  value: string;
  itemGroups: IDropdownMenuItemGroup[];
  onSelect: (value: string) => void;
}

export interface IDropdownButtonGroupProps extends Omit<
  ButtonProps,
  'children' | 'onClick' | 'onSelect' | 'value' | 'className'
> {
  value: string;
  itemGroups: IDropdownMenuItemGroup[];
  onSelect: (value: string) => void;
  primaryLabel?: string;
  onPrimaryClick?: () => void;
}
