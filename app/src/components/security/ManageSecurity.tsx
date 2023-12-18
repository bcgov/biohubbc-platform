import { mdiChevronDown, mdiChevronUp, mdiLock, mdiLockOpenOutline, mdiSecurity } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Menu, MenuItem } from '@mui/material';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import React, { useState } from 'react';
import SecuritiesDialog from './SecuritiesDialog';
import UnsecureDialog from './UnsecureDialog';

interface IManageSecurityProps {
  features: number[];
}

const ManageSecurity = (props: IManageSecurityProps) => {
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
      <SecuritiesDialog
        features={props.features}
        isOpen={isSecuritiesDialogOpen}
        onClose={() => setIsSecuritiesDialogOpen(false)}
      />
      <UnsecureDialog
        features={props.features}
        isOpen={isUnsecureDialogOpen}
        onClose={() => setIsUnsecuredDialogOpen(false)}
      />
      <Button
        color="primary"
        data-testid="manage-security"
        variant="outlined"
        onClick={handleClick}
        startIcon={<Icon path={mdiSecurity} size={0.75} />}
        endIcon={open ? <Icon path={mdiChevronUp} size={0.75} /> : <Icon path={mdiChevronDown} size={0.75} />}>
        Manage Security
      </Button>
      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}>
        <MenuItem onClick={() => setIsSecuritiesDialogOpen(true)}>
          <ListItemIcon>
            <Icon path={mdiLock} size={0.75} />
          </ListItemIcon>
          <ListItemText>Secure Records</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setIsUnsecuredDialogOpen(true)}>
          <ListItemIcon>
            <Icon path={mdiLockOpenOutline} size={0.75} />
          </ListItemIcon>
          <ListItemText>Unsecure Records</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ManageSecurity;
