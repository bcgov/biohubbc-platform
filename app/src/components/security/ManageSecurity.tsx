import { mdiChevronDown, mdiChevronUp, mdiLock, mdiLockOpenVariantOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Menu, MenuItem } from '@mui/material';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import React, { useState } from 'react';
import SecuritiesDialog from './SecuritiesDialog';
import UnsecureDialog from './UnsecureDialog';

const ManageSecurity = () => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isUnsecureDialogOpen, setIsUnsecuredDialogOpen] = useState(false);
  const [isSecuritiesDialogOpen, setIsSecuritiesDialogOpen] = useState(false);

  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <SecuritiesDialog isOpen={isSecuritiesDialogOpen} onClose={() => setIsSecuritiesDialogOpen(false)} />
      <UnsecureDialog isOpen={isUnsecureDialogOpen} onClose={() => setIsUnsecuredDialogOpen(false)} />
      <Button
        color="primary"
        data-testid="manage-security"
        variant="outlined"
        onClick={handleClick}
        endIcon={open ? <Icon path={mdiChevronUp} size={1} /> : <Icon path={mdiChevronDown} size={1} />}>
        Manage Security
      </Button>
      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={() => setIsSecuritiesDialogOpen(true)}>
          <ListItemIcon>
            <Icon path={mdiLock} size={1} />
          </ListItemIcon>
          <ListItemText>Secure Records</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setIsUnsecuredDialogOpen(true)}>
          <ListItemIcon>
            <Icon path={mdiLockOpenVariantOutline} size={1} />
          </ListItemIcon>
          <ListItemText>Unsecure Records</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ManageSecurity;
