import Typography from '@mui/material/Typography';
import EditDialog from 'components/dialog/EditDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { ISecurityRuleAndCategory } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useSubmissionContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import SecurityRuleForm, { ISecurityRuleFormikProps, SecurityRuleFormYupSchema } from './SecurityRuleForm';

interface ISecuritiesDialogProps {
  features: number[];
  isOpen: boolean;
  onClose: () => void;
}

const SecuritiesDialog = (props: ISecuritiesDialogProps) => {
  const dialogContext = useDialogContext();
  const api = useApi();

  const submissionFeatureRulesDataLoader = useDataLoader(api.security.getSecurityRulesForSubmissions);
  submissionFeatureRulesDataLoader.load(props.features);

  const submissionContext = useSubmissionContext();
  const securityRules = submissionContext.securityRulesDataLoader.data || [];

  const initialAppliedSecurityRules: ISecurityRuleAndCategory[] = !submissionFeatureRulesDataLoader.data?.length
    ? []
    : securityRules.filter((securityRule) => {
        return submissionFeatureRulesDataLoader.data?.some(
          (securityRecord) => securityRule.security_rule_id === securityRecord.security_rule_id
        );
      });

  const handleSubmit = async (rules: ISecurityRuleAndCategory[]) => {
    try {
      await api.submissions
        .applySubmissionFeatureRules(
          props.features,
          rules.map((item) => item.security_rule_id)
        )
        .then(() => {
          submissionFeatureRulesDataLoader.refresh(props.features);
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
      dialogTitle="Secure Records"
      open={props.isOpen}
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
