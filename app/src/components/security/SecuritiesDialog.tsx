import EditDialog from 'components/dialog/EditDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { useDialogContext, useSubmissionContext } from 'hooks/useContext';
import { useState } from 'react';
import SecurityRuleForm from './SecurityRuleForm';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import { IPatchFeatureSecurityRules } from 'interfaces/useSecurityApi.interface';
import yup from 'utils/YupSchema';



interface ISecuritiesDialogProps {
  submissionFeatureIds: GridRowSelectionModel
  open: boolean;
  onClose: () => void;
}

const SecuritiesDialog = (props: ISecuritiesDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const dialogContext = useDialogContext();

  const submissionContext = useSubmissionContext();
  const { submissionFeaturesAppliedRulesDataLoader } = submissionContext;

  const hasSecurity = Boolean(submissionFeaturesAppliedRulesDataLoader.data?.length);

  const handleSave = async (values: IPatchFeatureSecurityRules) => {
    try {
      setIsLoading(true);

      // await api.security
      //   .applySecurityRulesToSubmissionFeatures(
      //     props.features,
      //     rules.map((item) => item.security_rule_id),
      //     true // Override will replace all rules on submit
      //   )
      //   .then(() => {
      //     submissionContext.submissionFeaturesAppliedRulesDataLoader.refresh();
      //   });

      // dialogContext.setSnackbar({
      //   snackbarMessage: (
      //     <Typography variant="body2" component="div">
      //       {ApplySecurityRulesI18N.applySecuritySuccess(rules.length, numSelectedSubmissionFeatures)}
      //     </Typography>
      //   ),
      //   open: true
      // });

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
    <EditDialog<IPatchFeatureSecurityRules>
      isLoading={isLoading}
      dialogTitle={hasSecurity ? 'Edit Security Reasons' : ' Add Security Reasons'}
      open={props.open}
      dialogSaveButtonLabel="APPLY"
      onCancel={props.onClose}
      onSave={handleSave}
      component={{
        element: <SecurityRuleForm />,
        initialValues: { submissionFeatureIds: props.submissionFeatureIds, stagedForRemove: [], stagedForApply: [] },
        validationSchema: yup.object()
      }}
    />
  );
};

export default SecuritiesDialog;
