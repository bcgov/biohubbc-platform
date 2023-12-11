import EditDialog from 'components/dialog/EditDialog';
import { ISecurityRule } from 'hooks/api/useSecurityApi';
import yup from 'utils/YupSchema';
import SecurityRuleForm from './SecurityRuleForm';
interface ISecuritiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityRuleYupSchema = yup.object().shape({
  rules: yup.array(yup.number())
});

export interface ISecurityRuleFormProps {
  rules: ISecurityRule[];
}

const SecuritiesDialog = (props: ISecuritiesDialogProps) => {
  return (
    <>
      <EditDialog
        dialogTitle="Manage Security Reasons"
        open={props.isOpen}
        dialogSaveButtonLabel="APPLY"
        onCancel={props.onClose}
        onSave={() => console.log('SAVE SOME SECURITY RULES SON')}
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
