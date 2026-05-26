import Icon from '@mdi/react';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type { IDropdownMenuProps } from './DropdownMenu.interface';

/**
 * Reusable grouped menu for dropdown controls.
 * Renders item groups separated by dividers, marks the active `value`, and delegates selection to the parent.
 * Parent controls are responsible for anchoring and open/close state, typically via `useDropdownMenu`.
 *
 * @param {IDropdownMenuProps} props
 * @return {*}
 */
export const DropdownMenu = (props: IDropdownMenuProps) => {
  const { anchorEl, open, value, itemGroups, onClose, onSelect } = props;

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      {itemGroups.flatMap((group, groupIndex) => [
        ...group.items.map((item) => (
          <MenuItem
            key={`${group.groupId}-${item.value}`}
            selected={item.value === value}
            disabled={item.disabled}
            onClick={() => onSelect(item.value)}>
            <ListItemIcon>
              <Icon path={item.iconPath} size={0.75} />
            </ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        )),
        ...(groupIndex < itemGroups.length - 1 ? [<Divider key={`${group.groupId}-divider`} />] : [])
      ])}
    </Menu>
  );
};
