import { codeQueryKeys } from 'utils/query-keys/code-query-keys';
import { refreshChangedQueries } from 'utils/query-client';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import { EditDialog } from 'components/dialog/EditDialog';
import { BlueprintForm } from '../dialog/BlueprintForm';
import { blueprintFormSchema } from '../dialog/ConfigurationFormYupSchema';
import { useParentBlueprintOptions } from '../hooks/useParentBlueprintOptions';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { keepPreviousData, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import { useState } from 'react';
import { IBlueprintFormValues } from '../dialog/ConfigurationForm.interface';
import { BlueprintsTable } from '../table/BlueprintsTable';
import dayjs from 'dayjs';
import { getConfigurationStatus } from '../utils/lifecycleStatus';

/**
 * Own blueprint metadata loading, mutations, lifecycle rules, and parent queries.
 *
 * @returns Blueprint administration table with domain handlers and dialog state.
 */
export const BlueprintsSection = () => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogs = useDialogContext();
  const [saveError, setSaveError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IBlueprint | null>(null);
  const [busy, setBusy] = useState(false);
  const retireMutation = useMutation({ mutationFn: (id: number) => api.blueprints.retireBlueprint(id) });
  const defaultMutation = useMutation({ mutationFn: (id: number) => api.blueprints.setDefaultBlueprint(id) });
  const queryClient = useQueryClient();
  const table = useServerPaginatedGridState({ defaultSort: { field: 'version_number', sort: 'desc' } });
  const query = useQuery({
    queryKey: ['configuration', 'blueprints', table.debouncedSearchTerm, table.apiPagination],
    queryFn: () => api.blueprints.getBlueprints({ keyword: table.debouncedSearchTerm }, table.apiPagination),
    placeholderData: keepPreviousData
  });

  /**
   * Refresh cached configuration data after a confirmed mutation.
   *
   * @returns Resolves after active configuration queries refresh.
   */
  const refresh = () => refreshChangedQueries(queryClient, [['configuration'], codeQueryKeys.all()]);

  /**
   * Explain an in-progress mutation without disabling the action controls.
   *
   * @returns Whether the requested action must wait.
   */
  const isBusy = () => {
    if (busy) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Please wait for the current action to finish' });
    }
    return busy;
  };

  const initialValues: IBlueprintFormValues = editing
    ? {
        name: editing.name,
        description: editing.description ?? '',
        parentBlueprintId: editing.parent_blueprint_id ?? ''
      }
    : { name: '', description: '', parentBlueprintId: '' };

  /**
   * Save metadata and reconcile the affected page from the confirmed server state.
   *
   * @param values Validated form values.
   * @returns Resolves after save or inline error feedback.
   */
  const saveMutation = useMutation({
    mutationFn: async (values: IBlueprintFormValues) => {
      const payload = {
        name: values.name.trim(),
        description: values.description || null,
        parentBlueprintId: values.parentBlueprintId ? Number(values.parentBlueprintId) : null
      };
      if (editing) {
        await api.blueprints.updateBlueprint(editing.blueprint_id, {
          name: payload.name,
          description: payload.description
        });
      } else {
        await api.blueprints.createBlueprint(payload);
      }
    }
  });

  /**
   * Save form values and display the confirmed result or inline error.
   *
   * @param values Validated form values.
   * @returns Resolves after saving or displaying the error.
   */
  const save = async (values: IBlueprintFormValues) => {
    if (isBusy()) {
      return;
    }
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

  /**
   * Confirm the lifecycle action using the existing administrative confirmation dialog.
   *
   * @param row Selected metadata row.
   */
  const confirmRetire = (row: IBlueprint) => {
    if (isBusy()) {
      return;
    }
    if (row.is_default) {
      dialogs.setSnackbar({
        open: true,
        snackbarMessage: 'Cannot retire default blueprint. Select another default first.'
      });
      return;
    }
    if (row.record_end_date) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Blueprint is already retired' });
      return;
    }
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: 'Retire blueprint?',
      dialogContent: `This blueprint will remain in lifecycle history and cannot be edited after retirement. (${row.name})`,
      yesButtonLabel: 'Retire',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => dialogs.setYesNoDialog({ open: false }),
      onNo: () => dialogs.setYesNoDialog({ open: false }),
      onYes: async () => {
        dialogs.setYesNoDialog({ open: false });
        setBusy(true);
        try {
          await retireMutation.mutateAsync(row.blueprint_id);
          await refresh();
          dialogs.setSnackbar({ open: true, snackbarMessage: 'Retire successful' });
        } catch (error) {
          dialogs.setSnackbar({ open: true, snackbarMessage: (error as Error).message });
        } finally {
          setBusy(false);
        }
      }
    });
  };

  /**
   * Reconcile the default transition only after the server validates and commits it.
   *
   * @param row Selected blueprint.
   * @returns Resolves after reconciliation or error feedback.
   */
  const makeDefault = async (row: IBlueprint) => {
    setBusy(true);
    try {
      await defaultMutation.mutateAsync(row.blueprint_id);
      await refresh();
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Default blueprint updated' });
    } catch (error) {
      dialogs.setSnackbar({ open: true, snackbarMessage: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Confirm replacing the current default before submitting the lifecycle action.
   *
   * @param row Blueprint to set as default.
   */
  const confirmDefault = (row: IBlueprint) => {
    if (isBusy()) {
      return;
    }
    if (row.is_default) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Blueprint is already the default' });
      return;
    }
    if (row.record_end_date || !row.record_effective_date || row.record_effective_date > dayjs().format('YYYY-MM-DD')) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Only effective blueprints can be made default' });
      return;
    }
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: 'Set as default?',
      dialogContent: `Set "${row.name}" as the default blueprint? This will replace the current default blueprint.`,
      yesButtonLabel: 'Set as default',
      noButtonLabel: 'Cancel',
      onClose: () => dialogs.setYesNoDialog({ open: false }),
      onNo: () => dialogs.setYesNoDialog({ open: false }),
      onYes: async () => {
        dialogs.setYesNoDialog({ open: false });
        await makeDefault(row);
      }
    });
  };

  /**
   * Open the metadata edit dialog after checking blueprint lifecycle.
   *
   * @param row Selected blueprint.
   */
  const handleEditBlueprint = (row: IBlueprint) => {
    if (isBusy()) {
      return;
    }
    if (row.record_end_date) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Cannot edit a retired blueprint' });
      return;
    }
    setEditing(row);
    setDialogOpen(true);
    setSaveError('');
  };

  /**
   * Open a new blueprint metadata dialog.
   */
  const handleCreateBlueprint = () => {
    if (isBusy()) {
      return;
    }
    setEditing(null);
    setDialogOpen(true);
    setSaveError('');
  };

  const parentOptions = useParentBlueprintOptions(dialogOpen && !editing);

  return (
    <>
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      <BlueprintsTable
        table={table}
        rows={(query.data?.blueprints ?? []).map((blueprint) => ({
          ...blueprint,
          status: getConfigurationStatus(blueprint)
        }))}
        rowCount={query.data?.pagination.total ?? 0}
        isLoading={query.isPending}
        onOpenBlueprint={(blueprint) => navigate(`/admin/configuration/blueprints/${blueprint.blueprint_id}`)}
        onCreateBlueprint={handleCreateBlueprint}
        onEditBlueprint={handleEditBlueprint}
        onRetireBlueprint={confirmRetire}
        onSetDefaultBlueprint={confirmDefault}
      />
      <EditDialog
        open={dialogOpen}
        dialogTitle={editing ? 'Edit blueprint' : 'Create blueprint'}
        dialogSaveButtonLabel={editing ? 'Save' : 'Create'}
        dialogError={saveError}
        maxWidth="sm"
        onCancel={() => setDialogOpen(false)}
        onSave={save}
        component={{
          element: <BlueprintForm parentOptions={editing ? undefined : parentOptions} />,
          initialValues,
          validationSchema: blueprintFormSchema
        }}
      />
    </>
  );
};
