import Typography from '@mui/material/Typography';
import EditDialog from 'components/dialog/EditDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { ISecurityRuleAndCategory } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useSubmissionContext } from 'hooks/useContext';
import { useState } from 'react';
import SecurityRuleForm, { ISecurityRuleFormikProps, SecurityRuleFormYupSchema } from './SecurityRuleForm';

interface ISecuritiesDialogProps {
  submissionFeatureIds: number[];
  open: boolean;
  onClose: () => void;
}

const SecuritiesDialog = (props: ISecuritiesDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
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
      setIsLoading(true);
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
            {ApplySecurityRulesI18N.applySecuritySuccess(rules.length, props.features.length)}
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
      setIsLoading(false);
      props.onClose();
    }
  };

  return (
    <EditDialog
      isLoading={isLoading}
      dialogTitle={hasSecurity ? 'Edit Security Reasons' : ' Add Security Reasons'}
      open={props.open}
      dialogSaveButtonLabel="APPLY"
      onCancel={props.onClose}
      onSave={(values: ISecurityRuleFormikProps) => handleSubmit(values.rules)}
      component={{
        element: <SecurityRuleForm />,
        initialValues: { rules: initialAppliedSecurityRules },
        validationSchema: SecurityRuleFormYupSchema
      }}
    />
  );
};

export default SecuritiesDialog;
