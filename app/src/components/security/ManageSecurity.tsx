import { mdiChevronDown, mdiChevronUp, mdiCog, mdiLock, mdiLockOpenVariantOutline } from '@mdi/js';
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

  // this needs to go fetch all the security rules for the given features
  // const securityRuleDataLoader = useDataLoader(() => {
  //   return useApi().security.getActiveSecurityRules();
  // });
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
        startIcon={<Icon path={mdiCog} size={1} />}
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
