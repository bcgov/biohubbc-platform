import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import { EditDialog } from 'components/dialog/EditDialog';
import { typeAssignmentSchema } from '../dialog/CompositionFormSchema';
import { TypeAssignmentForm } from '../dialog/TypeAssignmentForm';
import { useBlueprintTypes } from '../hooks/useBlueprintTypes';
import { BlueprintTypesTable } from '../table/BlueprintTypesTable';

interface IBlueprintFeatureTypesSectionProps {
  blueprintId: number;
  readOnly: boolean;
  tab: string;
}

/**
 * Coordinate blueprint feature-type loading, assignment mutations, and the selection dialog.
 *
 * @param props Blueprint scope and derived interaction state.
 * @returns Independent table and dialog presentations.
 */
export const BlueprintFeatureTypesSection = ({ blueprintId, readOnly, tab }: IBlueprintFeatureTypesSectionProps) => {
  const navigate = useNavigate();
  const {
    table,
    error,
    saveError,
    open,
    initialValues,
    onCancel,
    onCreateBlueprintFeatureType,
    onSaveBlueprintFeatureType,
    onDeleteBlueprintFeatureType,
    featureTypeOptions
  } = useBlueprintTypes({ blueprintId, readOnly });
  return tab === 'feature-types' ? (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      <BlueprintTypesTable
        table={table}
        onOpen={(assignment) =>
          navigate(
            `/admin/configuration/blueprints/${blueprintId}/feature_type/${assignment.blueprint_feature_type_id}`
          )
        }
        onCreate={readOnly ? undefined : onCreateBlueprintFeatureType}
        onDelete={onDeleteBlueprintFeatureType}
      />
      <EditDialog
        open={open}
        dialogTitle="Assign Feature Types"
        dialogSaveButtonLabel="Save"
        dialogError={saveError}
        maxWidth="sm"
        onCancel={onCancel}
        onSave={onSaveBlueprintFeatureType}
        component={{
          element: <TypeAssignmentForm featureTypeOptions={featureTypeOptions} />,
          initialValues,
          validationSchema: typeAssignmentSchema
        }}
      />
    </>
  ) : null;
};
