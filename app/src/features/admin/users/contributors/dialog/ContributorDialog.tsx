import { EditDialog } from 'components/dialog/EditDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IContributor, IContributorInput } from 'interfaces/useContributorsApi.interface';
import { useState } from 'react';
import * as Yup from 'yup';
import { ContributorForm } from '../form/ContributorForm';

const validationSchema = Yup.object({
  clientId: Yup.string().trim().required('Client ID is required').max(100),
  description: Yup.string().nullable().max(1000)
});
interface IContributorDialogProps {
  record?: IContributor;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Create or edit an active contributor, retaining input on failure.
 * @param props - Existing record and completion callbacks.
 * @returns Validated edit dialog.
 */
export const ContributorDialog = ({ record, onClose, onSaved }: IContributorDialogProps) => {
  const api = useApi();
  const dialogs = useDialogContext();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const initialValues: IContributorInput = {
    clientId: record?.client_id ?? '',
    description: record?.description ?? null
  };
  /**
   * Persist the form and notify its owning list after success.
   * @param values - Validated form selections.
   * @returns Completion of the save attempt.
   */
  const handleSave = async (values: IContributorInput) => {
    if (saving) {
      return;
    }
    const input = { clientId: values.clientId.trim(), description: values.description || null };
    setSaving(true);
    setError('');
    try {
      if (record) {
        await api.contributors.updateContributor(record.contributor_id, input);
      } else {
        await api.contributors.createContributor(input);
      }
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Contributor saved.' });
      onSaved();
      onClose();
    } catch (caughtError) {
      setError((caughtError as Error).message || 'Unable to save contributor.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <EditDialog
      open
      dialogTitle={record ? 'Edit contributor' : 'Add contributor'}
      isLoading={saving}
      dialogError={error}
      component={{ element: <ContributorForm />, initialValues, validationSchema }}
      onCancel={onClose}
      onSave={handleSave}
    />
  );
};
