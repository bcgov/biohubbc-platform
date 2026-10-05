import { mdiDotsVertical, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Box } from '@mui/material';
import { ContextMenuButton } from 'components/ContextMenuButton';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IContributorUser } from 'interfaces/useContributorsApi.interface';

interface IContributorUserActionsProps {
  record: IContributorUser;
  onChanged: () => void;
}

/**
 * Confirmed soft-delete action for an active contributor user.
 * @param props - Record and refresh callback.
 * @returns Row actions, or no actions for ended records.
 */
export const ContributorUserActions = ({ record, onChanged }: IContributorUserActionsProps) => {
  const api = useApi();
  const dialogs = useDialogContext();
  if (record.record_end_date) {
    return null;
  }
  const handleClose = () => dialogs.setYesNoDialog({ open: false });
  const handleConfirmDelete = () => {
    let pending = false;
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete contributor user?',
      dialogContent: 'This ends the relationship. Historical records are retained.',
      yesButtonLabel: 'Delete',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: handleClose,
      onNo: handleClose,
      onYes: async () => {
        if (pending) {
          return;
        }
        pending = true;
        try {
          await api.contributors.deleteContributorUser(record.contributor_system_user_id);
          handleClose();
          onChanged();
          dialogs.setSnackbar({ open: true, snackbarMessage: 'Contributor user deleted.' });
        } catch (caughtError) {
          handleClose();
          dialogs.setErrorDialog({
            open: true,
            dialogTitle: 'Unable to delete contributor user',
            dialogText: (caughtError as Error).message,
            onClose: () => dialogs.setErrorDialog({ open: false }),
            onOk: () => dialogs.setErrorDialog({ open: false })
          });
        } finally {
          pending = false;
        }
      }
    });
  };
  return (
    <Box onClick={(event) => event.stopPropagation()}>
      <ContextMenuButton
        buttonTitle="Actions"
        buttonIcon={<Icon path={mdiDotsVertical} size={0.75} />}
        itemGroups={[
          {
            groupId: 'danger-actions',
            items: [
              { label: 'Delete', icon: <Icon path={mdiTrashCanOutline} size={0.7} />, onClick: handleConfirmDelete }
            ]
          }
        ]}
      />
    </Box>
  );
};
