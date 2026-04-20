import { EditDialog } from 'components/dialog/EditDialog';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { transformApiToPolicyJson } from '../utils/policyTransform';
import { AddPolicyForm, AddPolicyFormYupSchema, IAddPolicyFormValues } from './AddPolicyForm';

interface IEditPolicyDialogProps {
  open: boolean;
  isLoading: boolean;
  policy: IPolicy;
  initialValues?: Partial<IAddPolicyFormValues>;
  onCancel: () => void;
  onSave: (values: IAddPolicyFormValues) => void;
}

/**
 * Shared edit-policy dialog for policy management workflows.
 *
 * @param {IEditPolicyDialogProps} props
 * @return {*}
 */
export const EditPolicyDialog = (props: IEditPolicyDialogProps) => {
  const { open, isLoading, policy, initialValues, onCancel, onSave } = props;

  const mergedInitialValues: IAddPolicyFormValues = {
    name: policy.name,
    description: policy.description || '',
    status: policy.status,
    policy_json: transformApiToPolicyJson(policy.statements),
    ...initialValues
  };

  return (
    <EditDialog<IAddPolicyFormValues>
      isLoading={isLoading}
      dialogTitle="Edit Policy"
      dialogSaveButtonLabel="Save"
      open={open}
      component={{
        element: <AddPolicyForm />,
        initialValues: mergedInitialValues,
        validationSchema: AddPolicyFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
