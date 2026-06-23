import { EditDialog } from 'components/dialog/EditDialog';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { IPolicyFormValues, PolicyForm, PolicyFormYupSchema } from './PolicyForm';

interface IEditPolicyDialogProps {
  open: boolean;
  isLoading: boolean;
  policy: IPolicy;
  initialValues?: Partial<IPolicyFormValues>;
  onCancel: () => void;
  onSave: (values: IPolicyFormValues) => void;
}

/**
 * Shared edit-policy dialog for policy management workflows.
 *
 * @param {IEditPolicyDialogProps} props
 * @return {*}
 */
export const EditPolicyDialog = (props: IEditPolicyDialogProps) => {
  const { open, isLoading, policy, initialValues, onCancel, onSave } = props;

  const mergedInitialValues: IPolicyFormValues = {
    name: policy.name,
    description: policy.description || '',
    status: policy.status,
    ...initialValues
  };

  return (
    <EditDialog<IPolicyFormValues>
      isLoading={isLoading}
      dialogTitle="Edit Policy"
      dialogSaveButtonLabel="Save"
      open={open}
      maxWidth="md"
      component={{
        element: <PolicyForm />,
        initialValues: mergedInitialValues,
        validationSchema: PolicyFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
