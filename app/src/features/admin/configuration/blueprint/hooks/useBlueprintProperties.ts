import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { keepPreviousDataWithin, refreshChangedQueries } from 'utils/query-client';
import {
  IBlueprintFeatureTypeProperty,
  IUpdateBlueprintFeatureTypeProperty
} from 'interfaces/useBlueprintFeatureTypePropertiesApi.interface';
import { useCallback, useRef, useState } from 'react';
import { IPropertyAssignmentForm } from '../dialog/CompositionForm.interface';
import { CompositionOptionsFetcher } from '../dialog/CompositionOptions.interface';
import { useCompositionOptions } from './useCompositionOptions';

interface IUseBlueprintPropertiesOptions {
  blueprintId: number;
  blueprintFeatureTypeId: number;
  readOnly: boolean;
}

/**
 * Own properties loading, mutations, lifecycle feedback, and assignment dialogs.
 *
 * @param options Blueprint scope and lifecycle restrictions.
 * @returns Data and domain handlers for the presentation table and form.
 */
export const useBlueprintProperties = ({
  blueprintId,
  blueprintFeatureTypeId,
  readOnly
}: IUseBlueprintPropertiesOptions) => {
  const api = useApi();
  const dialogs = useDialogContext();
  const [saveError, setSaveError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IBlueprintFeatureTypeProperty | null>(null);
  const busy = useRef(false);
  const [pendingProperties, setPendingProperties] = useState<IPropertyAssignmentForm['properties']>([]);
  const queryClient = useQueryClient();
  const table = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const scopeKey = ['configuration', 'blueprint', blueprintId, 'type', blueprintFeatureTypeId, 'properties'];
  const query = useQuery({
    queryKey: [...scopeKey, table.debouncedSearchTerm, table.apiPagination],
    queryFn: () =>
      api.blueprintFeatureTypeProperties.getBlueprintFeatureTypeProperties(blueprintId, {
        blueprintFeatureTypeId,
        keyword: table.debouncedSearchTerm,
        ...table.apiPagination
      }),
    placeholderData: keepPreviousDataWithin(scopeKey)
  });
  const rows = query.data?.properties ?? [];
  /**
   * Refresh the owning blueprint's composition and selectors after a mutation.
   *
   * @returns Resolves after mounted queries refresh.
   */
  const refresh = () => refreshChangedQueries(queryClient, [['configuration', 'blueprint', blueprintId]]);
  const createMutation = useMutation({
    mutationFn: (featurePropertyId: number) =>
      api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty(blueprintId, {
        blueprintFeatureTypeId,
        featurePropertyId
      })
  });
  const updateMutation = useMutation({
    mutationFn: ({ assignmentId, data }: { assignmentId: number; data: IUpdateBlueprintFeatureTypeProperty }) =>
      api.blueprintFeatureTypeProperties.updateBlueprintFeatureTypeProperty(blueprintId, assignmentId, data)
  });
  const deleteMutation = useMutation({
    mutationFn: (assignmentId: number) =>
      api.blueprintFeatureTypeProperties.deleteBlueprintFeatureTypeProperty(blueprintId, assignmentId)
  });
  const initialValues: IPropertyAssignmentForm = {
    properties: pendingProperties,
    blueprintFeatureTypeId,
    featurePropertyId: editing?.feature_property_id ?? '',
    requiredValue: editing?.required_value ?? false,
    allowMultiple: editing?.allow_multiple ?? false
  };

  /**
   * Explain read-only lifecycle or concurrent submissions without disabling controls.
   *
   * @returns Whether lifecycle or an in-progress mutation blocks this action.
   */
  const isActionBlocked = () => {
    if (readOnly) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'This section is read-only' });
      return true;
    }
    if (busy.current) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Please wait for the current action to finish' });
    }
    return busy.current;
  };

  /**
   * Persist assignment changes and refresh the scoped property table.
   *
   * @param values Formik assignment values.
   * @returns Resolves after confirmation or error feedback.
   */
  const handleSaveBlueprintFeatureProperty = async (values: IPropertyAssignmentForm) => {
    if (isActionBlocked()) {
      return;
    }
    busy.current = true;
    setSaveError('');
    const payload = {
      requiredValue: values.requiredValue,
      allowMultiple: values.allowMultiple
    };
    const remainingProperties = [...values.properties];
    try {
      if (editing) {
        await updateMutation.mutateAsync({ assignmentId: editing.blueprint_feature_type_property_id, data: payload });
      } else {
        // Settle every independent assignment so failures retain only selections that still need saving.
        const results = await Promise.allSettled(
          values.properties.map((property) => createMutation.mutateAsync(property.featurePropertyId))
        );
        const unsavedProperties = values.properties.filter((_property, index) => results[index].status === 'rejected');
        remainingProperties.splice(0, remainingProperties.length, ...unsavedProperties);
        const failure = results.find((result) => result.status === 'rejected');
        if (failure?.status === 'rejected') {
          throw failure.reason;
        }
      }
      setOpen(false);
      await refresh();
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Assignment saved' });
    } catch (error) {
      setPendingProperties(remainingProperties);
      await refresh();
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
  const handleDeleteBlueprintFeatureProperty = (row: IBlueprintFeatureTypeProperty) => {
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
      dialogContent: `Delete "${row.display_name}"? The assignment remains in history and cannot be edited.`,
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
          await deleteMutation.mutateAsync(row.blueprint_feature_type_property_id);
          if (rows.length === 1 && table.paginationModel.page > 0) {
            table.handlePaginationChange({ ...table.paginationModel, page: table.paginationModel.page - 1 });
          }
          await refresh();
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
   * Open the edit dialog after checking assignment lifecycle.
   *
   * @param row Selected assignment.
   */
  const handleEditBlueprintFeatureProperty = (row: IBlueprintFeatureTypeProperty) => {
    if (isActionBlocked()) {
      return;
    }
    if (row.record_end_date) {
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Cannot edit deleted assignment' });
      return;
    }
    setEditing(row);
    setSaveError('');
    setOpen(true);
  };

  /**
   * Open a new assignment dialog when composition is editable.
   */
  const handleCreateBlueprintFeatureProperty = () => {
    if (isActionBlocked()) {
      return;
    }
    setPendingProperties([]);
    setEditing(null);
    setSaveError('');
    setOpen(true);
  };

  /**
   * Search eligible reusable properties for this assignment.
   *
   * @param keyword Name or display-name search.
   * @param pagination Search result limit and ordering.
   * @returns The first ten eligible properties in name order.
   */
  const fetchAvailableFeatureProperties = useCallback<CompositionOptionsFetcher>(
    (keyword, pagination) =>
      api.featureProperties.getAvailableFeaturePropertiesForBlueprintFeatureType(blueprintId, blueprintFeatureTypeId, {
        keyword,
        ...pagination
      }),
    [api.featureProperties, blueprintId, blueprintFeatureTypeId]
  );

  const propertyOptions = useCompositionOptions(fetchAvailableFeatureProperties, open && !editing, [
    'configuration',
    'blueprint',
    blueprintId,
    'type',
    blueprintFeatureTypeId,
    'availableProperties'
  ]);

  return {
    table,
    rows,
    rowCount: query.data?.pagination.total ?? 0,
    isLoading: query.isPending,
    error: query.error?.message ?? '',
    saveError,
    open,
    editing,
    initialValues,
    onCancel: () => setOpen(false),
    onCreateBlueprintFeatureProperty: handleCreateBlueprintFeatureProperty,
    onEditBlueprintFeatureProperty: handleEditBlueprintFeatureProperty,
    onSaveBlueprintFeatureProperty: handleSaveBlueprintFeatureProperty,
    onDeleteBlueprintFeatureProperty: handleDeleteBlueprintFeatureProperty,
    propertyOptions
  };
};
