import { EditDialog } from 'components/dialog/EditDialog';
import {
  IPolicyExpressionFormValues,
  PolicyExpressionForm,
  PolicyExpressionFormInitialValues,
  PolicyExpressionFormYupSchema
} from './PolicyExpressionForm';

interface IPolicyExpressionDialogProps {
  open: boolean;
  isLoading: boolean;
  mode: 'create' | 'edit';
  initialValues?: IPolicyExpressionFormValues;
  onCancel: () => void;
  onSave: (values: IPolicyExpressionFormValues) => void;
}

/**
 * Dialog for creating or editing a policy expression.
 *
 * @param {IPolicyExpressionDialogProps} props
 * @returns {JSX.Element}
 */
export const PolicyExpressionDialog = (props: IPolicyExpressionDialogProps) => {
  const { open, isLoading, mode, initialValues, onCancel, onSave } = props;
  const isCreate = mode === 'create';

  return (
    <EditDialog<IPolicyExpressionFormValues>
      isLoading={isLoading}
      dialogTitle={isCreate ? 'Create Expression' : 'Edit Expression'}
      dialogSaveButtonLabel={isCreate ? 'Create' : 'Save'}
      open={open}
      maxWidth="md"
      component={{
        element: <PolicyExpressionForm />,
        initialValues: initialValues ?? PolicyExpressionFormInitialValues,
        validationSchema: PolicyExpressionFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
