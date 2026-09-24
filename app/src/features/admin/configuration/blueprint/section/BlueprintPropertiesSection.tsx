import Alert from '@mui/material/Alert';
import { EditDialog } from 'components/dialog/EditDialog';
import { PropertySelectionForm } from '../dialog/PropertySelectionForm';
import { useBlueprintProperties } from '../hooks/useBlueprintProperties';
import { PropertyAssignmentForm } from '../dialog/PropertyAssignmentForm';
import { createPropertyAssignmentSchema, propertyAssignmentSchema } from '../dialog/CompositionFormSchema';
import { BlueprintPropertiesTable } from '../table/BlueprintPropertiesTable';

interface IBlueprintPropertiesSectionProps {
  blueprintId: number;
  readOnly: boolean;
  blueprintFeatureTypeId: number;
}

/**
 * Coordinate blueprint property loading, assignment mutations, and selection or settings dialogs.
 *
 * @param props Blueprint scope and derived interaction state.
 * @returns Independent table and dialog presentations.
 */
export const BlueprintPropertiesSection = ({
  blueprintId,
  blueprintFeatureTypeId,
  readOnly
}: IBlueprintPropertiesSectionProps) => {
  const {
    table,
    error,
    saveError,
    open,
    editing,
    initialValues,
    onCancel,
    onCreateBlueprintFeatureProperty,
    onEditBlueprintFeatureProperty,
    onSaveBlueprintFeatureProperty,
    onDeleteBlueprintFeatureProperty,
    propertyOptions
  } = useBlueprintProperties({ blueprintId, blueprintFeatureTypeId, readOnly });
  return (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      <BlueprintPropertiesTable
        table={table}
        onCreate={readOnly ? undefined : onCreateBlueprintFeatureProperty}
        onDelete={onDeleteBlueprintFeatureProperty}
        onEdit={onEditBlueprintFeatureProperty}
      />
      <EditDialog
        open={open}
        dialogTitle={editing ? `Edit ${editing.display_name} assignment` : 'Assign properties'}
        dialogSaveButtonLabel="Save"
        dialogError={saveError}
        maxWidth="sm"
        onCancel={onCancel}
        onSave={onSaveBlueprintFeatureProperty}
        component={{
          element: editing ? <PropertyAssignmentForm /> : <PropertySelectionForm options={propertyOptions} />,
          initialValues,
          validationSchema: editing ? propertyAssignmentSchema : createPropertyAssignmentSchema
        }}
      />
    </>
  );
};
