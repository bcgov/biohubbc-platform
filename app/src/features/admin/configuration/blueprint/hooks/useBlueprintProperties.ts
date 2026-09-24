import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IBlueprintFeatureTypeProperty } from 'interfaces/useBlueprintFeatureTypePropertiesApi.interface';
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
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IBlueprintFeatureTypeProperty | null>(null);
  const busy = useRef(false);
  const [pendingProperties, setPendingProperties] = useState<IPropertyAssignmentForm['properties']>([]);
  const table = useServerPaginatedDataGrid({
    fetcher: async (keyword, pagination) => {
      try {
        const result = await api.blueprintFeatureTypeProperties.getBlueprintFeatureTypeProperties(blueprintId, {
          keyword,
          blueprintFeatureTypeId,
          ...pagination
        });
        setError('');
        return result;
      } catch (error) {
        setError((error as Error).message);
        throw error;
      }
    },
    extractData: (response) => response.properties,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });
  const refresh = useRef(table.refresh);
  refresh.current = table.refresh;
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
        await api.blueprintFeatureTypeProperties.updateBlueprintFeatureTypeProperty(
          blueprintId,
          editing.blueprint_feature_type_property_id,
          payload
        );
      } else {
        // Keep unconfirmed selections on failure so retry never duplicates a successful assignment.
        for (const property of values.properties) {
          await api.blueprintFeatureTypeProperties.createBlueprintFeatureTypeProperty(blueprintId, {
            blueprintFeatureTypeId,
            featurePropertyId: property.featurePropertyId
          });
          remainingProperties.shift();
        }
      }
      setOpen(false);
      refresh.current();
      dialogs.setSnackbar({ open: true, snackbarMessage: 'Assignment saved' });
    } catch (error) {
      setPendingProperties(remainingProperties);
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
          await api.blueprintFeatureTypeProperties.deleteBlueprintFeatureTypeProperty(
            blueprintId,
            row.blueprint_feature_type_property_id
          );
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

  const propertyOptions = useCompositionOptions(
    fetchAvailableFeatureProperties,
    open && !editing,
    blueprintFeatureTypeId
  );

  return {
    table,
    error,
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
