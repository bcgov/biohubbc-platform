import EditDialog from 'components/dialog/EditDialog';
import yup from 'utils/YupSchema';
import SecurityRuleForm from './SecurityRuleForm';
interface ISecuritiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SecuritiesDialog = (props: ISecuritiesDialogProps) => {
  const SecurityRuleYupSchema = yup.array(yup.number());

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
          initialValues: [],
          validationSchema: SecurityRuleYupSchema
        }}
      />
    </>
  );
};

export default SecuritiesDialog;
