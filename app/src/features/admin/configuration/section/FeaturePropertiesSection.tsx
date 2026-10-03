import { useConfigurationRetirement } from '../hooks/useConfigurationRetirement';
import { codeQueryKeys } from 'utils/query-keys/code-query-keys';
import { refreshChangedQueries } from 'utils/query-client';
import Alert from '@mui/material/Alert';
import { EditDialog } from 'components/dialog/EditDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { keepPreviousData, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IFeatureProperty } from 'interfaces/useFeaturePropertiesApi.interface';
import { useState } from 'react';
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
  const [saveError, setSaveError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IFeatureProperty | null>(null);
  const [busy, setBusy] = useState(false);
  const retireMutation = useMutation({ mutationFn: (id: number) => api.featureProperties.deleteFeatureProperty(id) });
  const queryClient = useQueryClient();
  const table = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const query = useQuery({
    queryKey: ['configuration', 'featureProperties', table.debouncedSearchTerm, table.apiPagination],
    queryFn: () =>
      api.featureProperties.getFeatureProperties({ search: table.debouncedSearchTerm }, table.apiPagination),
    placeholderData: keepPreviousData
  });

  /**
   * Refresh cached configuration data after a confirmed mutation.
   *
   * @returns Resolves after active configuration queries refresh.
   */
  const refresh = () => refreshChangedQueries(queryClient, [['configuration'], codeQueryKeys.all()]);

  const typesQuery = useQuery({
    queryKey: ['configuration', 'propertyTypes'],
    queryFn: api.featureProperties.getFeaturePropertyTypes
  });
  const propertyTypes = typesQuery.data?.feature_property_types ?? [];

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
  const saveMutation = useMutation({
    mutationFn: async (values: IFeaturePropertyFormValues) => {
      const payload = {
        display_name: values.display_name.trim(),
        description: values.description || null
      };
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
    }
  });

  /**
   * Save form values and display the confirmed result or inline error.
   *
   * @param values Validated form values.
   * @returns Resolves after saving or displaying the error.
   */
  const save = async (values: IFeaturePropertyFormValues) => {
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

  const retirement = useConfigurationRetirement<IFeatureProperty>({
    label: 'feature property',
    retire: (row) => retireMutation.mutateAsync(row.feature_property_id),
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
      {Boolean(typesQuery.error) && (
        <Alert severity="error">Unable to load property types. Try reopening Configuration.</Alert>
      )}
      <FeaturePropertiesTable
        table={table}
        rows={query.data?.feature_properties ?? []}
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
        dialogTitle={editing ? 'Edit feature property' : 'Create feature property'}
        dialogSaveButtonLabel={editing ? 'Save' : 'Create'}
        isLoading={busy || retirement.isRetiring}
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
