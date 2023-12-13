import Typography from '@mui/material/Typography';
import EditDialog from 'components/dialog/EditDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { DialogContext } from 'contexts/dialogContext';
import { ISecurityRule } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import { useContext } from 'react';
import yup from 'utils/YupSchema';
import SecurityRuleForm from './SecurityRuleForm';
interface ISecuritiesDialogProps {
  submissions: number[];
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
  const dialogContext = useContext(DialogContext);
  const api = useApi();

  const handleSubmit = async (rules: ISecurityRule[]) => {
    try {
      await api.security.applySecurityRulesToSubmissions(
        props.submissions,
        rules.map((item) => item.security_rule_id)
      );

      dialogContext.setSnackbar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            {ApplySecurityRulesI18N.applySecuritySuccess(props.submissions.length)}
          </Typography>
        ),
        open: true
      });
    } catch (error) {
      // Show error dialog
      dialogContext.setErrorDialog({
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        dialogTitle: ApplySecurityRulesI18N.applySecurityRulesErrorTitle,
        dialogText: ApplySecurityRulesI18N.applySecurityRulesErrorText,
        open: true
      });
    } finally {
      props.onClose();
    }
  };

  return (
    <>
      <EditDialog
        dialogTitle="Manage Security Reasons"
        open={props.isOpen}
        dialogSaveButtonLabel="APPLY"
        onCancel={props.onClose}
        onSave={(values: ISecurityRuleFormProps) => handleSubmit(values.rules)}
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
