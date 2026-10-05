import { useConfigurationRetirement } from '../hooks/useConfigurationRetirement';
import { codeQueryKeys } from 'utils/query-keys/code-query-keys';
import { refreshChangedQueries } from 'utils/query-client';
import Alert from '@mui/material/Alert';
import { EditDialog } from 'components/dialog/EditDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { keepPreviousData, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
  const [saveError, setSaveError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IFeatureType | null>(null);
  const [busy, setBusy] = useState(false);
  const retireMutation = useMutation({ mutationFn: (id: number) => api.featureTypes.deleteFeatureType(id) });
  const queryClient = useQueryClient();
  const table = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const query = useQuery({
    queryKey: ['configuration', 'featureTypes', table.debouncedSearchTerm, table.apiPagination],
    queryFn: () => api.featureTypes.getFeatureTypes({ search: table.debouncedSearchTerm }, table.apiPagination),
    placeholderData: keepPreviousData
  });

  /**
   * Refresh cached configuration data after a confirmed mutation.
   *
   * @returns Resolves after active configuration queries refresh.
   */
  const refresh = () => refreshChangedQueries(queryClient, [['configuration'], codeQueryKeys.all()]);

  const initialValues: IFeatureTypeFormValues = editing
    ? { name: editing.name, display_name: editing.display_name, description: editing.description ?? '' }
    : { name: '', display_name: '', description: '' };

  /**
   * Save metadata and reconcile the affected page from the confirmed server state.
   * @param values Validated form values.
   * @returns Resolves after save or inline error feedback.
   */
  const saveMutation = useMutation({
    mutationFn: async (values: IFeatureTypeFormValues) => {
      const payload = {
        display_name: values.display_name.trim(),
        description: values.description || null
      };
      if (editing) {
        await api.featureTypes.updateFeatureType(editing.feature_type_id, payload);
      } else {
        await api.featureTypes.createFeatureType({ ...payload, name: values.name.trim() });
      }
    }
  });

  /**
   * Save form values and display the confirmed result or inline error.
   *
   * @param values Validated form values.
   * @returns Resolves after saving or displaying the error.
   */
  const save = async (values: IFeatureTypeFormValues) => {
    setBusy(true);
    setSaveError('');
    try {
      await saveMutation.mutateAsync(values);
      setDialogOpen(false);
      await refresh();
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Saved successfully' });
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const retirement = useConfigurationRetirement<IFeatureType>({
    label: 'feature type',
    retire: (row) => retireMutation.mutateAsync(row.feature_type_id),
    refresh
  });

  return (
    <>
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      {retirement.error && (
        <Alert severity="error" onClose={retirement.clearError}>
          {retirement.error}
        </Alert>
      )}

      <FeatureTypesTable
        table={table}
        rows={query.data?.feature_types ?? []}
        rowCount={query.data?.pagination.total ?? 0}
        isLoading={query.isPending}
        busy={busy || retirement.isRetiring}
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
        onRetire={retirement.confirmRetire}
      />
      <EditDialog
        open={dialogOpen}
        dialogTitle={editing ? 'Edit feature type' : 'Create feature type'}
        dialogSaveButtonLabel={editing ? 'Save' : 'Create'}
        isLoading={busy || retirement.isRetiring}
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
