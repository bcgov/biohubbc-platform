import { mdiDotsVertical, mdiLockPlus, mdiTrashCanOutline, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import { useState } from 'react';

interface IAttachmentItemMenuButtonProps {
  artifact: IArtifact;
  onDownload: (artifact: IArtifact) => void;
  hasAdministrativePermissions: boolean;
  isPendingReview: boolean;
}

const AttachmentItemMenuButton: React.FC<IAttachmentItemMenuButtonProps> = (props) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

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
            {props.hasAdministrativePermissions && (
              <MenuItem
                onClick={() => {
                  console.log('Apply security not implemented yet.');
                  setAnchorEl(null);
                }}
                data-testid="attachment-action-menu-apply-security">
                <ListItemIcon>
                  <Icon path={mdiLockPlus} size={0.8} />
                </ListItemIcon>
                Apply Security
              </MenuItem>
            )}
            <MenuItem
              disabled={!props.hasAdministrativePermissions}
              onClick={() => {
                props.onDownload(props.artifact);
                setAnchorEl(null);
              }}
              data-testid="attachment-action-menu-download">
              <ListItemIcon>
                <Icon path={mdiTrayArrowDown} size={0.875} />
              </ListItemIcon>
              Download Document
            </MenuItem>
            {props.hasAdministrativePermissions && (
              <MenuItem
                onClick={() => {
                  console.log('Delete artifact not implemented yet.');
                  setAnchorEl(null);
                }}
                data-testid="attachment-action-menu-delete">
                <ListItemIcon>
                  <Icon path={mdiTrashCanOutline} size={0.8} />
                </ListItemIcon>
                Delete Document
              </MenuItem>
            )}
          </Menu>
        </Box>
      </Box>
    </>
  );
};

export default AttachmentItemMenuButton;
