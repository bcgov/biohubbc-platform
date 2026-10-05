import { mdiDotsVertical, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Box } from '@mui/material';
import { ContextMenuButton } from 'components/ContextMenuButton';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IContributor } from 'interfaces/useContributorsApi.interface';
import { useState } from 'react';
import { ContributorDialog } from '../dialog/ContributorDialog';

interface IContributorActionsProps {
  record: IContributor;
  onChanged: () => void;
}

/**
 * Edit and confirmed soft-delete actions for an active contributor.
 * @param props - Record and refresh callback.
 * @returns Row actions, or no actions for ended records.
 */
export const ContributorActions = ({ record, onChanged }: IContributorActionsProps) => {
  const api = useApi();
  const dialogs = useDialogContext();
  const [editing, setEditing] = useState(false);
  if (record.record_end_date) {
    return null;
  }
  const handleClose = () => dialogs.setYesNoDialog({ open: false });
  const handleConfirmDelete = () => {
    let pending = false;
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete contributor?',
      dialogContent:
        'This ends the contributor and all its active user relationships. Historical records are retained.',
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
          await api.contributors.deleteContributor(record.contributor_id);
          handleClose();
          onChanged();
          dialogs.setSnackbar({ open: true, snackbarMessage: 'Contributor deleted.' });
        } catch (caughtError) {
          handleClose();
          dialogs.setErrorDialog({
            open: true,
            dialogTitle: 'Unable to delete contributor',
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
            groupId: 'edit-actions',
            items: [
              { label: 'Edit', icon: <Icon path={mdiPencilOutline} size={0.7} />, onClick: () => setEditing(true) }
            ]
          },
          {
            groupId: 'danger-actions',
            items: [
              { label: 'Delete', icon: <Icon path={mdiTrashCanOutline} size={0.7} />, onClick: handleConfirmDelete }
            ]
          }
        ]}
      />
      {editing && <ContributorDialog record={record} onClose={() => setEditing(false)} onSaved={onChanged} />}
    </Box>
  );
};
