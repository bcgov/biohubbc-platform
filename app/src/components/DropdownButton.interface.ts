import type { ButtonProps } from '@mui/material/Button';
import type { IDropdownMenuItemGroup } from './menu/DropdownMenu.interface';

export interface IDropdownButtonProps extends Omit<ButtonProps, 'onClick' | 'onSelect' | 'value'> {
  value: string | null;
  itemGroups: IDropdownMenuItemGroup[];
  onSelect: (value: string) => void;
}
