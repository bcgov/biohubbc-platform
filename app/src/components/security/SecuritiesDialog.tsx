import EditDialog from 'components/dialog/EditDialog';
import { ISecurityRule } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import yup from 'utils/YupSchema';
import SecurityRuleForm from './SecurityRuleForm';
interface ISecuritiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityRuleYupSchema = yup.object().shape({
  rules: yup.array(yup.object()).min(1)
});

export interface ISecurityRuleFormProps {
  rules: ISecurityRule[];
}

const SecuritiesDialog = (props: ISecuritiesDialogProps) => {
  const handleSubmit = async (rules: ISecurityRule[]) => {
    const api = useApi();

    const response = await api.security.applySecurityRulesToSubmissions([], []);
  };

  return (
    <>
      <EditDialog
        dialogTitle="Manage Security Reasons"
        open={props.isOpen}
        dialogSaveButtonLabel="APPLY"
        onCancel={props.onClose}
        onSave={(values) => handleSubmit(values.rules)}
        component={{
          element: <SecurityRuleForm />,
          initialValues: { rules: [] },
          validationSchema: SecurityRuleYupSchema
        }}
      />
    </>
  );
};

export default SecuritiesDialog;
