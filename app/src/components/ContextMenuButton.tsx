import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Fragment, ReactNode, useMemo, useState } from 'react';

export interface IContextMenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface IContextMenuItemGroup {
  groupId: string;
  items: IContextMenuItem[];
}

export interface IContextMenuButtonProps {
  buttonTitle: string;
  buttonIcon: ReactNode;
  itemGroups: IContextMenuItemGroup[];
}

/**
 * Compact icon-triggered context menu.
 *
 * @param {IContextMenuButtonProps} props
 * @return {*}
 */
export const ContextMenuButton = (props: IContextMenuButtonProps) => {
  const { buttonTitle, buttonIcon, itemGroups } = props;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const open = Boolean(anchorEl);
  const resolvedGroups = useMemo(() => itemGroups.filter((group) => group.items.length > 0), [itemGroups]);
  const handleClose = () => setAnchorEl(null);
  const handleItemClick = (onClick: () => void) => {
    handleClose();
    onClick();
  };

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

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {resolvedGroups.map((group, groupIndex) => (
          <Fragment key={group.groupId}>
            {group.items.map((item) => (
              <MenuItem
                key={`${group.groupId}-${item.label}`}
                disabled={item.disabled}
                onClick={() => handleItemClick(item.onClick)}>
                {item.icon ? <ListItemIcon>{item.icon}</ListItemIcon> : null}
                {item.label}
              </MenuItem>
            ))}
            {groupIndex < resolvedGroups.length - 1 ? <Divider /> : null}
          </Fragment>
        ))}
      </Menu>
    </>
  );
};
