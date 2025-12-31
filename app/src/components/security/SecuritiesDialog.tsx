import { Typography } from '@mui/material';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import EditDialog from 'components/dialog/EditDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { ISecurityRuleAndCategory } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useSubmissionContext } from 'hooks/useContext';
import { IPatchFeatureSecurityRules } from 'interfaces/useSecurityApi.interface';
import { useEffect, useMemo, useState } from 'react';
import yup from 'utils/YupSchema';
import { SecurityRuleForm } from './SecurityRuleForm';

const SecurityValidationSchema = yup.object().shape({
  stagedForApply: yup.array().of(
    yup.object({
      security_rule_id: yup.number().required()
    })
  ),
  stagedForRemove: yup.array().of(
    yup.object({
      security_rule_id: yup.number().required()
    })
  )
});

interface ISecuritiesDialogProps {
  submissionFeatureIds: Pick<GridRowSelectionModel, 'ids'>;
  open: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export interface ISecurityFormValues {
  stagedForApply: ISecurityRuleAndCategory[];
  stagedForRemove: ISecurityRuleAndCategory[];
}

const SecuritiesDialog = ({ submissionFeatureIds, open, onSubmit, onClose }: ISecuritiesDialogProps) => {
  const [isSaving, setIsSaving] = useState(false);

  const api = useApi();
  const dialogContext = useDialogContext();
  const { submissionId, securityDataLoader, allSecurityRulesDataLoader } = useSubmissionContext();

  const selectedFeatureIds = useMemo(() => [...submissionFeatureIds.ids].map(Number), [submissionFeatureIds.ids]);
  const isWholeSubmission = selectedFeatureIds.length === 0;
  const hasSecurity = Boolean(securityDataLoader.data?.rules.length);

  // Refresh security rules whenever dialog opens
  useEffect(() => {
    if (open) {
      securityDataLoader.refresh(isWholeSubmission ? undefined : selectedFeatureIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isWholeSubmission, selectedFeatureIds]);

  // Compute initial staged rules
  const initialFormValues: ISecurityFormValues = useMemo(() => {
    return {
      stagedForApply:
        securityDataLoader.data?.rules
          ?.map((appliedRule) => {
            return allSecurityRulesDataLoader.data?.find(
              (option) => option.security_rule_id === appliedRule.security_rule_id
            );
          })
          .filter((rule): rule is ISecurityRuleAndCategory => rule != null) ?? [],
      stagedForRemove: []
    };
  }, [securityDataLoader.data?.rules, allSecurityRulesDataLoader.data]);

  const clearSecurityDataLoader = () => {
    securityDataLoader.setData({ rules: [] });
  };

  // Save staged changes from Formik values
  const handleSave = async (values: ISecurityFormValues) => {
    try {
      setIsSaving(true);

      const patch: IPatchFeatureSecurityRules = {
        submissionFeatureIds: selectedFeatureIds,
        stagedForApply: values.stagedForApply,
        stagedForRemove: values.stagedForRemove
      };

      if (isWholeSubmission) {
        await api.security.patchSecurityRulesOnSubmission(submissionId, patch);
      } else {
        await api.security.patchSecurityRulesOnSubmissionFeatures(submissionId, patch);
      }

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (
          <Typography variant="body2">
            {ApplySecurityRulesI18N.applySecuritySuccess(selectedFeatureIds.length || 1)}
          </Typography>
        )
      });

      onSubmit();
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: ApplySecurityRulesI18N.applySecurityRulesErrorTitle,
        dialogText: ApplySecurityRulesI18N.applySecurityRulesErrorText,
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    } finally {
      setIsSaving(false);
      clearSecurityDataLoader();
    }
  };

  return (
    <EditDialog<ISecurityFormValues>
      open={open}
      isLoading={isSaving}
      dialogTitle={hasSecurity ? 'Edit Security' : 'Add Security'}
      dialogSaveButtonLabel="APPLY"
      onCancel={() => {
        onClose();
        clearSecurityDataLoader();
      }}
      onSave={handleSave}
      component={{
        element: (
          <SecurityRuleForm
            options={allSecurityRulesDataLoader.data ?? []}
            isLoading={allSecurityRulesDataLoader.isLoading || securityDataLoader.isLoading}
          />
        ),
        initialValues: initialFormValues,
        validationSchema: SecurityValidationSchema
      }}
    />
  );
};

export default SecuritiesDialog;
