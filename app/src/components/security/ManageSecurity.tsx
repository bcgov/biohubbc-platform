import { mdiChevronDown, mdiChevronUp } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Menu, MenuItem } from '@mui/material';
import React from 'react';

const ManageSecurity: React.FC = () => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  return (
    <>
      <Button
        color="primary"
        data-testid="manage-security"
        variant="outlined"
        onClick={handleClick}
        endIcon={open ? <Icon path={mdiChevronUp} size={1}/> : <Icon path={mdiChevronDown} size={1}/>}>
        Manage Security
      </Button>
      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem>Secure Records</MenuItem>
        <MenuItem>Unsecure Records</MenuItem>
      </Menu>
    </>
  );
};

export default ManageSecurity;
