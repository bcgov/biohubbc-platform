import { mdiMenuDown } from '@mdi/js';
import Icon from '@mdi/react';
import type { ButtonProps } from '@mui/material/Button';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useMemo, useState } from 'react';

export interface IDropdownButtonItem {
  value: string;
  label: string;
  iconPath: string;
}

export interface IDropdownButtonItemGroup {
  groupId: string;
  items: IDropdownButtonItem[];
}

export interface IDropdownButtonProps
  extends Omit<ButtonProps, 'children' | 'onClick' | 'onSelect' | 'value' | 'className'> {
  value: string;
  itemGroups: IDropdownButtonItemGroup[];
  onSelect: (value: string) => void;
}

/**
 * Single-button dropdown menu showing the currently selected option label.
 *
 * @param {IDropdownButtonProps} props
 * @return {*}
 */
export const DropdownButton = (props: IDropdownButtonProps) => {
  const { value, itemGroups, onSelect, size = 'medium', ...buttonProps } = props;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const flattenedItems = useMemo(() => itemGroups.flatMap((group) => group.items), [itemGroups]);
  const selectedLabel = useMemo(
    () => flattenedItems.find((item) => item.value === value)?.label ?? value,
    [flattenedItems, value]
  );

  return (
    <>
      <Button
        variant="outlined"
        size={size}
        {...buttonProps}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        endIcon={<Icon path={mdiMenuDown} size={1} />}
        sx={{
          minWidth: size === 'small' ? 128 : 180,
          justifyContent: 'space-between',
          textTransform: 'none',
          backgroundColor: 'grey.50',
          ...(size === 'small'
            ? {
                height: 34,
                px: 1.5,
                fontSize: 14
              }
            : null),
          ...buttonProps.sx
        }}>
        {selectedLabel}
      </Button>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {itemGroups.flatMap((group, groupIndex) => [
          ...group.items.map((item) => (
            <MenuItem
              key={`${group.groupId}-${item.value}`}
              selected={item.value === value}
              onClick={() => {
                setAnchorEl(null);
                onSelect(item.value);
              }}>
              <ListItemIcon>
                <Icon path={item.iconPath} size={0.75} />
              </ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          )),
          ...(groupIndex < itemGroups.length - 1 ? [<Divider key={`${group.groupId}-divider`} />] : [])
        ])}
      </Menu>
    </>
  );
};
