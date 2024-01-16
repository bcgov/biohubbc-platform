import { Typography } from '@mui/material';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import EditDialog from 'components/dialog/EditDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useSubmissionContext } from 'hooks/useContext';
import { IPatchFeatureSecurityRules } from 'interfaces/useSecurityApi.interface';
import { useState } from 'react';
import yup from 'utils/YupSchema';
import SecurityRuleForm from './SecurityRuleForm';

interface ISecuritiesDialogProps {
  submissionFeatureIds: GridRowSelectionModel;
  open: boolean;
  onClose: () => void;
}

const SecuritiesDialog = (props: ISecuritiesDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const dialogContext = useDialogContext();
  const api = useApi();

  const submissionContext = useSubmissionContext();
  const { submissionFeaturesAppliedRulesDataLoader, submissionId } = submissionContext;

  const hasSecurity = Boolean(submissionFeaturesAppliedRulesDataLoader.data?.length);

  const handleSave = async (patch: IPatchFeatureSecurityRules) => {
    try {
      setIsLoading(true);

      await api.security.patchSecurityRulesOnSubmissionFeatures(submissionId, patch);

      dialogContext.setSnackbar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            {ApplySecurityRulesI18N.applySecuritySuccess(
              patch.stagedForApply.length,
              patch.stagedForRemove.length,
              props.submissionFeatureIds.length
            )}
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
