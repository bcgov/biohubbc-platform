import { mdiDotsVertical, mdiLockOutline, mdiLockPlus, mdiTrashCanOutline, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { IArtifact, SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import { useState } from 'react';

interface IAttachmentItemMenuButtonProps {
  artifact: IArtifact;
  onDownload: (artifact: IArtifact) => void;
  onDelete: (artifactUUID: string[]) => void;
  onRequestAccess: (artifact: IArtifact) => void;
  onApplySecurity: (artifact: IArtifact) => void;
  hasAdministrativePermissions: boolean;
  isPendingReview: boolean;
}

const AttachmentItemMenuButton: React.FC<IAttachmentItemMenuButtonProps> = (props) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const canDownload =
    props.hasAdministrativePermissions ||
    props.artifact.supplementaryData.persecutionAndHarm === SECURITY_APPLIED_STATUS.UNSECURED;

  const handleClick = (event: any) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Box my={-1}>
        <Box>
          <IconButton aria-label="Document actions" onClick={handleClick} data-testid="attachment-action-menu">
            <Icon path={mdiDotsVertical} size={1} />
          </IconButton>
          <Menu
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right'
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right'
            }}
            id="basic-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            MenuListProps={{
              'aria-labelledby': 'basic-button'
            }}>
            {canDownload ? (
              <MenuItem
                onClick={() => {
                  props.onDownload(props.artifact);
                  handleClose();
                }}
                data-testid="attachment-action-menu-download">
                <ListItemIcon>
                  <Icon path={mdiTrayArrowDown} size={0.875} />
                </ListItemIcon>
                Download Document
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  props.onRequestAccess(props.artifact);
                  handleClose();
                }}
                data-testid="attachment-action-menu-request-access">
                <ListItemIcon>
                  <Icon path={mdiLockOutline} size={0.875} />
                </ListItemIcon>
                Request Access
              </MenuItem>
            )}

            {props.hasAdministrativePermissions && (
              <>
                <MenuItem
                  onClick={() => {
                    props.onApplySecurity(props.artifact);
                    handleClose();
                  }}
                  data-testid="attachment-action-menu-download">
                  <ListItemIcon>
                    <Icon path={mdiLockPlus} size={0.875} />
                  </ListItemIcon>
                  Apply Security to Document
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    console.log('Delete artifact not implemented yet.');
                    handleClose();
                  }}
                  data-testid="attachment-action-menu-delete">
                  <ListItemIcon>
                    <Icon path={mdiTrashCanOutline} size={0.8} />
                  </ListItemIcon>
                  Delete Document
                </MenuItem>
              </>
            )}
          </Menu>
        </Box>
      </Box>
    </>
  );
};

export default AttachmentItemMenuButton;
