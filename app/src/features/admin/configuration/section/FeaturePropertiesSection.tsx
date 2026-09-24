import Alert from '@mui/material/Alert';
import { EditDialog } from 'components/dialog/EditDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IFeatureProperty } from 'interfaces/useFeaturePropertiesApi.interface';
import { useState } from 'react';
import { useEffect } from 'react';
import useDataLoader from 'hooks/useDataLoader';
import { FeaturePropertyForm } from '../dialog/FeaturePropertyForm';
import { IFeaturePropertyFormValues } from '../dialog/ConfigurationForm.interface';
import { featurePropertyFormSchema } from '../dialog/ConfigurationFormYupSchema';
import { FeaturePropertiesTable } from '../table/FeaturePropertiesTable';

/**
 * Coordinate catalogue loading, metadata editing, and retirement feedback.
 *
 * @returns Definition table and its independently rendered metadata dialog.
 */
export const FeaturePropertiesSection = () => {
  const api = useApi();
  const dialogs = useDialogContext();
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IFeatureProperty | null>(null);
  const [busy, setBusy] = useState(false);
  const table = useServerPaginatedDataGrid({
    fetcher: async (search, pagination) => {
      try {
        const response = await api.featureProperties.getFeatureProperties({ search: search }, pagination);
        setLoadError('');
        return response;
      } catch (error) {
        setLoadError((error as Error).message);
        throw error;
      }
    },
    extractData: (response) => response.feature_properties,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

  const typesLoader = useDataLoader(api.featureProperties.getFeaturePropertyTypes);
  useEffect(() => {
    typesLoader.load();
  }, [typesLoader]);
  const propertyTypes = typesLoader.data?.feature_property_types ?? [];

  const initialValues: IFeaturePropertyFormValues = editing
    ? {
        name: editing.name,
        display_name: editing.display_name,
        description: editing.description ?? '',
        feature_property_type_id: editing.feature_property_type_id,
        calculated_value: editing.calculated_value
      }
    : { name: '', display_name: '', description: '', feature_property_type_id: '', calculated_value: false };

  /**
   * Save metadata and reconcile the affected page from the confirmed server state.
   * @param values Validated form values.
   * @returns Resolves after save or inline error feedback.
   */
  const save = async (values: IFeaturePropertyFormValues) => {
    setBusy(true);
    setSaveError('');
    const payload = {
      display_name: values.display_name.trim(),
      description: values.description || null
    };
    try {
      if (editing) {
        await api.featureProperties.updateFeatureProperty(editing.feature_property_id, payload);
      } else {
        await api.featureProperties.createFeatureProperty({
          ...payload,
          name: values.name.trim(),
          calculated_value: values.calculated_value,
          feature_property_type_id: Number(values.feature_property_type_id)
        });
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
  const confirmRetire = (row: IFeatureProperty) => {
    if (row.record_end_date) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'This feature property is already retired' });
      return;
    }
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: 'Retire feature property?',
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
          await api.featureProperties.deleteFeatureProperty(row.feature_property_id);
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
      {Boolean(typesLoader.error) && (
        <Alert severity="error">Unable to load property types. Try reopening Configuration.</Alert>
      )}
      <FeaturePropertiesTable
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
        dialogTitle={editing ? 'Edit feature property' : 'Create feature property'}
        dialogSaveButtonLabel={editing ? 'Save' : 'Create'}
        isLoading={busy}
        dialogError={saveError}
        maxWidth="sm"
        onCancel={() => setDialogOpen(false)}
        onSave={save}
        component={{
          element: <FeaturePropertyForm propertyTypes={propertyTypes} editing={Boolean(editing)} />,
          initialValues,
          validationSchema: editing
            ? featurePropertyFormSchema.pick(['display_name', 'description'])
            : featurePropertyFormSchema
        }}
      />
    </>
  );
};
