import Alert from '@mui/material/Alert';
import { EditDialog } from 'components/dialog/EditDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IFeatureType } from 'interfaces/useFeatureTypesApi.interface';
import { useState } from 'react';
import { FeatureTypeForm } from '../dialog/FeatureTypeForm';
import { IFeatureTypeFormValues } from '../dialog/ConfigurationForm.interface';
import { featureTypeFormSchema } from '../dialog/ConfigurationFormYupSchema';
import { FeatureTypesTable } from '../table/FeatureTypesTable';

/**
 * Coordinate catalogue loading, metadata editing, and retirement feedback.
 *
 * @returns Definition table and its independently rendered metadata dialog.
 */
export const FeatureTypesSection = () => {
  const api = useApi();
  const dialogs = useDialogContext();
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IFeatureType | null>(null);
  const [busy, setBusy] = useState(false);
  const table = useServerPaginatedDataGrid({
    fetcher: async (search, pagination) => {
      try {
        const response = await api.featureTypes.getFeatureTypes({ search: search }, pagination);
        setLoadError('');
        return response;
      } catch (error) {
        setLoadError((error as Error).message);
        throw error;
      }
    },
    extractData: (response) => response.feature_types,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

  const initialValues: IFeatureTypeFormValues = editing
    ? { name: editing.name, display_name: editing.display_name, description: editing.description ?? '' }
    : { name: '', display_name: '', description: '' };

  /**
   * Save metadata and reconcile the affected page from the confirmed server state.
   * @param values Validated form values.
   * @returns Resolves after save or inline error feedback.
   */
  const save = async (values: IFeatureTypeFormValues) => {
    setBusy(true);
    setSaveError('');
    const payload = {
      display_name: values.display_name.trim(),
      description: values.description || null
    };
    try {
      if (editing) {
        await api.featureTypes.updateFeatureType(editing.feature_type_id, payload);
      } else {
        await api.featureTypes.createFeatureType({ ...payload, name: values.name.trim() });
      }
      setDialogOpen(false);
      table.refresh();
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Saved successfully' });
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Confirm the lifecycle action using the existing administrative confirmation dialog.
   * @param row Selected metadata row.
   */
  const confirmRetire = (row: IFeatureType) => {
    if (row.record_end_date) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'This feature type is already retired' });
      return;
    }
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: 'Retire feature type?',
      dialogContent: `This record will remain visible as Retired and will no longer be available for new assignments. (${row.name})`,
      yesButtonLabel: 'Retire',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => dialogs.setYesNoDialog({ open: false }),
      onNo: () => dialogs.setYesNoDialog({ open: false }),
      onYes: async () => {
        dialogs.setYesNoDialog({ open: false });
        setBusy(true);
        setActionError('');
        try {
          await api.featureTypes.deleteFeatureType(row.feature_type_id);
          table.refresh();
          dialogs.setSnackbar({ open: true, snackbarMessage: 'Retired successfully' });
        } catch (error) {
          setActionError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }
    });
  };

  return (
    <>
      {loadError && (
        <Alert severity="error" onClose={() => setLoadError('')}>
          {loadError}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      <FeatureTypesTable
        table={table}
        busy={busy}
        onCreate={() => {
          setEditing(null);
          setDialogOpen(true);
          setSaveError('');
        }}
        onEdit={(row) => {
          setEditing(row);
          setDialogOpen(true);
          setSaveError('');
        }}
        onRetire={confirmRetire}
      />
      <EditDialog
        open={dialogOpen}
        dialogTitle={editing ? 'Edit feature type' : 'Create feature type'}
        dialogSaveButtonLabel={editing ? 'Save' : 'Create'}
        isLoading={busy}
        dialogError={saveError}
        maxWidth="sm"
        onCancel={() => setDialogOpen(false)}
        onSave={save}
        component={{
          element: <FeatureTypeForm editing={Boolean(editing)} />,
          initialValues,
          validationSchema: editing
            ? featureTypeFormSchema.pick(['display_name', 'description'])
            : featureTypeFormSchema
        }}
      />
    </>
  );
};
