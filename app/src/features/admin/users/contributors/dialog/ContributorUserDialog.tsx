import { EditDialog } from 'components/dialog/EditDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IContributor } from 'interfaces/useContributorsApi.interface';
import { useState } from 'react';
import * as Yup from 'yup';
import { ContributorUserForm, IContributorUserForm } from '../form/ContributorUserForm';

const validationSchema = Yup.object({
  user: Yup.object().nullable().required('Select a system user')
});
interface IContributorUserDialogProps {
  contributor: IContributor;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Create an active contributor user, retaining input on failure.
 * @param props - Initial contributor and completion callbacks.
 * @returns Validated edit dialog.
 */
export const ContributorUserDialog = ({ contributor, onClose, onSaved }: IContributorUserDialogProps) => {
  const api = useApi();
  const dialogs = useDialogContext();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const initialValues: IContributorUserForm = {
    user: null
  };
  /**
   * Persist the form and notify its owning list after success.
   * @param values - Validated form selections.
   * @returns Completion of the save attempt.
   */
  const handleSave = async (values: IContributorUserForm) => {
    if (saving) {
      return;
    }
    if (!values.user) {
      return;
    }
    const input = { contributorId: contributor.contributor_id, systemUserId: values.user.system_user_id };
    setSaving(true);
    setError('');
    try {
      await api.contributors.createContributorUser(input);
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Contributor user saved.' });
      onSaved();
      onClose();
    } catch (caughtError) {
      setError((caughtError as Error).message || 'Unable to save contributor user.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <EditDialog
      open
      dialogTitle="Add contributor user"
      isLoading={saving}
      dialogError={error}
      component={{ element: <ContributorUserForm disabled={saving} />, initialValues, validationSchema }}
      onCancel={onClose}
      onSave={handleSave}
    />
  );
};
