import Typography from '@mui/material/Typography';
import EditDialog from 'components/dialog/EditDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { ISecurityRuleAndCategory } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useSubmissionContext } from 'hooks/useContext';
import SecurityRuleForm, { ISecurityRuleFormikProps, SecurityRuleFormYupSchema } from './SecurityRuleForm';

interface ISecuritiesDialogProps {
  features: number[];
  open: boolean;
  onClose: () => void;
}

const SecuritiesDialog = (props: ISecuritiesDialogProps) => {
  const dialogContext = useDialogContext();
  const api = useApi();

  const submissionContext = useSubmissionContext();
  const { allSecurityRulesStaticListDataLoader, submissionFeaturesAppliedRulesDataLoader } = submissionContext;
  const allSecurityRules = allSecurityRulesStaticListDataLoader.data || [];
  const appliedSecurityRecords = submissionFeaturesAppliedRulesDataLoader.data || [];

  const initialAppliedSecurityRules: ISecurityRuleAndCategory[] = !appliedSecurityRecords.length
    ? []
    : allSecurityRules.filter((securityRule) => {
        return appliedSecurityRecords.some(
          (securityRecord) => securityRule.security_rule_id === securityRecord.security_rule_id
        );
      });
  const hasSecurity = Boolean(initialAppliedSecurityRules.length);
  const handleSubmit = async (rules: ISecurityRuleAndCategory[]) => {
    try {
      await api.security
        .applySecurityRulesToSubmissionFeatures(
          props.features,
          rules.map((item) => item.security_rule_id),
          true // Override will replace all rules on submit
        )
        .then(() => {
          submissionContext.submissionFeaturesAppliedRulesDataLoader.refresh();
        });

      dialogContext.setSnackbar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            {ApplySecurityRulesI18N.applySecuritySuccess(props.features.length)}
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
    <EditDialog
      dialogTitle={hasSecurity ? 'Edit Security Reasons' : ' Add Security Reasons'}
      open={props.open}
      dialogSaveButtonLabel="APPLY"
      onCancel={props.onClose}
      onSave={(values: ISecurityRuleFormikProps) => handleSubmit(values.rules)}
      component={{
        element: <SecurityRuleForm features={props.features} />,
        initialValues: { rules: initialAppliedSecurityRules },
        validationSchema: SecurityRuleFormYupSchema
      }}
    />
  );
};

export default SecuritiesDialog;
