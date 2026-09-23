import Alert from '@mui/material/Alert';
import { EditDialog } from 'components/dialog/EditDialog';
import { BlueprintForm } from '../dialog/BlueprintForm';
import { blueprintFormSchema } from '../dialog/ConfigurationFormYupSchema';
import { useParentBlueprintOptions } from '../hooks/useParentBlueprintOptions';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import { useState } from 'react';
import { IBlueprintFormValues } from '../dialog/ConfigurationForm.interface';
import { BlueprintsTable } from '../table/BlueprintsTable';
import dayjs from 'dayjs';
import { IBlueprintTableRow } from '../table/BlueprintsTable.interface';
import { getConfigurationStatus } from '../utils/lifecycleStatus';

/**
 * Own blueprint metadata loading, mutations, lifecycle rules, and parent queries.
 *
 * @returns Blueprint administration table with domain handlers and dialog state.
 */
export const BlueprintsSection = () => {
  const api = useApi();
  const dialogs = useDialogContext();
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IBlueprint | null>(null);
  const [busy, setBusy] = useState(false);
  const table = useServerPaginatedDataGrid({
    fetcher: async (search, pagination) => {
      try {
        const response = await api.blueprints.getBlueprints({ keyword: search }, pagination);
        setLoadError('');
        return response;
      } catch (error) {
        setLoadError((error as Error).message);
        throw error;
      }
    },
    extractData: (response): IBlueprintTableRow[] =>
      response.blueprints.map((blueprint) => ({
        ...blueprint,
        status: getConfigurationStatus(blueprint)
      })),
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'version_number', sort: 'desc' }
  });

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
  const save = async (values: IBlueprintFormValues) => {
    if (isBusy()) {
      return;
    }
    setBusy(true);
    setSaveError('');
    const payload = {
      name: values.name.trim(),
      description: values.description || null,
      parentBlueprintId: values.parentBlueprintId ? Number(values.parentBlueprintId) : null
    };
    try {
      if (editing) {
        await api.blueprints.updateBlueprint(editing.blueprint_id, {
          name: payload.name,
          description: payload.description
        });
      } else {
        await api.blueprints.createBlueprint(payload);
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
          await api.blueprints.retireBlueprint(row.blueprint_id);
          table.refresh();
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
      await api.blueprints.setDefaultBlueprint(row.blueprint_id);
      table.refresh();
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
      {loadError && (
        <Alert severity="error" onClose={() => setLoadError('')}>
          {loadError}
        </Alert>
      )}
      <BlueprintsTable
        table={table}
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
