import { mdiMenuDown } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import type { ButtonGroupProps } from '@mui/material/ButtonGroup';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { MouseEvent, useState } from 'react';

export interface IDropdownButtonGroupItem {
  label: string;
  onClick: () => void;
}

export interface IDropdownButtonGroupProps extends Omit<ButtonGroupProps, 'children' | 'onClick'> {
  label: string;
  onClick: () => void;
  items: IDropdownButtonGroupItem[];
  size?: 'small' | 'medium' | 'large';
}

/**
 * Split button with primary action and dropdown menu options.
 *
 * @param {IDropdownButtonGroupProps} props
 * @return {*}
 */
export const DropdownButtonGroup = (props: IDropdownButtonGroupProps) => {
  const { label, onClick, items, disabled, size = 'medium', variant = 'contained', ...buttonGroupProps } = props;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const closeMenu = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <ButtonGroup variant={variant} disabled={disabled} {...buttonGroupProps}>
        <Button size={size} onClick={onClick}>
          {label}
        </Button>
        <Button size={size} onClick={openMenu}>
          <Icon path={mdiMenuDown} size={1} />
        </Button>
      </ButtonGroup>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        {items.map((item) => (
          <MenuItem
            key={item.label}
            onClick={() => {
              closeMenu();
              item.onClick();
            }}>
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
