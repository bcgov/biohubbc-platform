import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IBlueprintFeatureType } from 'interfaces/useBlueprintFeatureTypesApi.interface';
import { useCallback, useRef, useState } from 'react';
import { ITypeAssignmentForm } from '../dialog/CompositionForm.interface';
import { CompositionOptionsFetcher } from '../dialog/CompositionOptions.interface';
import { useCompositionOptions } from './useCompositionOptions';

interface IUseBlueprintTypesOptions {
  blueprintId: number;
  readOnly: boolean;
}

/**
 * Own types loading, mutations, lifecycle feedback, and assignment dialogs.
 *
 * @param options Blueprint scope and lifecycle restrictions.
 * @returns Data and domain handlers for the presentation table and form.
 */
export const useBlueprintTypes = ({ blueprintId, readOnly }: IUseBlueprintTypesOptions) => {
  const api = useApi();
  const dialogs = useDialogContext();
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  const [pendingTypes, setPendingTypes] = useState<ITypeAssignmentForm['featureTypes']>([]);
  const table = useServerPaginatedDataGrid({
    fetcher: async (keyword, pagination) => {
      try {
        const result = await api.blueprintFeatureTypes.getBlueprintFeatureTypes(blueprintId, {
          keyword,
          ...pagination
        });
        setError('');
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    extractData: (response) => response.types,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });
  const refresh = useRef(table.refresh);
  refresh.current = table.refresh;
  const initialValues: ITypeAssignmentForm = {
    featureTypes: pendingTypes
  };

  /**
   * Explain read-only lifecycle or concurrent submissions without disabling controls.
   *
   * @returns Whether lifecycle or an in-progress mutation blocks this action.
   */
  const isActionBlocked = () => {
    if (readOnly) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Only draft and future blueprints can be edited' });
      return true;
    }
    if (busy.current) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Please wait for the current action to finish' });
    }
    return busy.current;
  };

  /**
   * Assign the selected global feature types and refresh the blueprint membership table.
   *
   * @param values Formik assignment values.
   * @returns Resolves after confirmation or error feedback.
   */
  const handleSaveBlueprintFeatureType = async (values: ITypeAssignmentForm) => {
    if (isActionBlocked()) {
      return;
    }
    busy.current = true;
    setSaveError('');
    const remainingTypes = [...values.featureTypes];
    try {
      for (const featureType of values.featureTypes) {
        await api.blueprintFeatureTypes.createBlueprintFeatureType(blueprintId, {
          featureTypeId: featureType.featureTypeId
        });
        remainingTypes.shift();
      }
      setOpen(false);
      refresh.current();
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Assignment saved' });
    } catch (error) {
      setPendingTypes(remainingTypes);
      refresh.current();
      setSaveError((error as Error).message);
      dialogs.setSnackbar({ open: true, snackbarMessage: (error as Error).message });
    } finally {
      busy.current = false;
    }
  };

  /**
   * Open the shared deletion confirmation, preserving history.
   *
   * @param row Assignment to delete.
   */
  const handleDeleteBlueprintFeatureType = (row: IBlueprintFeatureType) => {
    if (isActionBlocked()) {
      return;
    }
    if (row.record_end_date) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Assignment is already deleted' });
      return;
    }
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete assignment?',
      dialogContent: `Delete "${row.display_name}"? Its active properties will also be deleted. The assignment remains in history and cannot be edited.`,
      yesButtonLabel: 'Delete',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => dialogs.setYesNoDialog({ open: false }),
      onNo: () => dialogs.setYesNoDialog({ open: false }),
      onYes: async () => {
        if (isActionBlocked()) {
          return;
        }
        busy.current = true;
        dialogs.setYesNoDialog({ open: false });
        try {
          await api.blueprintFeatureTypes.deleteBlueprintFeatureType(blueprintId, row.blueprint_feature_type_id);
          if (table.rows.length === 1 && table.paginationModel.page > 0) {
            table.handlePaginationChange({ ...table.paginationModel, page: table.paginationModel.page - 1 });
          } else {
            refresh.current();
          }
          dialogs.setSnackbar({ open: true, snackbarMessage: 'Assignment deleted' });
        } catch (error) {
          dialogs.setSnackbar({ open: true, snackbarMessage: (error as Error).message });
        } finally {
          busy.current = false;
        }
      }
    });
  };

  /**
   * Open a new assignment dialog when composition is editable.
   */
  const handleCreateBlueprintFeatureType = () => {
    if (isActionBlocked()) {
      return;
    }
    setPendingTypes([]);
    setSaveError('');
    setOpen(true);
  };

  /**
   * Search global types eligible for this blueprint.
   *
   * @param keyword Name or display-name search.
   * @param pagination Requested page and sorting.
   * @returns Eligible type options and pagination.
   */
  const fetchAvailableFeatureTypes = useCallback<CompositionOptionsFetcher>(
    (keyword, pagination) =>
      api.featureTypes.getAvailableFeatureTypesForBlueprint(blueprintId, { keyword, ...pagination }),
    [api.featureTypes, blueprintId]
  );

  const featureTypeOptions = useCompositionOptions(fetchAvailableFeatureTypes, open, blueprintId);

  return {
    table,
    error,
    saveError,
    open,
    initialValues,
    onCancel: () => setOpen(false),
    onCreateBlueprintFeatureType: handleCreateBlueprintFeatureType,
    onSaveBlueprintFeatureType: handleSaveBlueprintFeatureType,
    onDeleteBlueprintFeatureType: handleDeleteBlueprintFeatureType,
    featureTypeOptions
  };
};
