import { Button, MenuItem } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import { ReactNode, useState } from 'react';

export interface IconButtonMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface IconButtonMenuProps {
  icon: ReactNode;
  menuItems: IconButtonMenuItem[];
}

/**
 * Displays an icon button that opens a menu when clicked
 *
 * @param {IconButtonMenuProps} props
 * @returns
 */
export const IconButtonMenu = (props: IconButtonMenuProps) => {
  const { icon, menuItems } = props;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton onClick={handleOpen}>{icon}</IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}>
        {menuItems.map((item, idx) => (
          <MenuItem
            key={idx}
            fullWidth
            component={Button}
            startIcon={item.icon}
            sx={{ textTransform: 'none' }}
            onClick={() => {
              item.onClick();
              handleClose();
            }}>
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
