import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { ReactNode, useMemo, useState } from 'react';

export interface IContextMenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface IContextMenuItemGroup {
  groupId: string;
  groupLabel?: string;
  items: IContextMenuItem[];
}

export interface IContextMenuButtonProps {
  buttonTitle: string;
  buttonIcon: ReactNode;
  items?: IContextMenuItem[];
  itemGroups?: IContextMenuItemGroup[];
}

/**
 * Compact icon-triggered context menu.
 *
 * @param {IContextMenuButtonProps} props
 * @return {*}
 */
export const ContextMenuButton = (props: IContextMenuButtonProps) => {
  const { buttonTitle, buttonIcon, items = [], itemGroups } = props;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const open = Boolean(anchorEl);
  const resolvedGroups = useMemo<IContextMenuItemGroup[]>(() => {
    if (itemGroups?.length) {
      return itemGroups.filter((group) => group.items.length > 0);
    }

    if (items.length) {
      return [{ groupId: 'default', items }];
    }

    return [];
  }, [itemGroups, items]);

  return (
    <>
      <IconButton
        title={buttonTitle}
        aria-label={buttonTitle}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}>
        {buttonIcon}
      </IconButton>

      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        {resolvedGroups.flatMap((group, groupIndex) => [
          ...(group.groupLabel
            ? [
                <ListSubheader
                  key={`${group.groupId}-label`}
                  disableSticky
                  sx={{ fontSize: '0.5rem', lineHeight: 1.2, textTransform: 'uppercase' }}>
                  {group.groupLabel}
                </ListSubheader>
              ]
            : []),
          ...group.items.map((item) => (
            <MenuItem
              key={`${group.groupId}-${item.label}`}
              disabled={item.disabled}
              onClick={() => {
                setAnchorEl(null);
                item.onClick();
              }}>
              {item.icon ? <ListItemIcon>{item.icon}</ListItemIcon> : null}
              {item.label}
            </MenuItem>
          )),
          ...(groupIndex < resolvedGroups.length - 1 ? [<Divider key={`${group.groupId}-divider`} />] : [])
        ])}
      </Menu>
    </>
  );
};
