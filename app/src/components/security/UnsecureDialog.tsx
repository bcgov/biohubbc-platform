import { Alert, AlertTitle, Typography } from '@mui/material';
import YesNoDialog from 'components/dialog/YesNoDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { DialogContext } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { useContext } from 'react';

interface IUnsecureDialogProps {
  features: number[];
  isOpen: boolean;
  onClose: () => void;
}
const UnsecureDialog = (props: IUnsecureDialogProps) => {
  const api = useApi();
  const dialogContext = useContext(DialogContext);

  const handleRemove = async () => {
    try {
      await api.submissions.applySubmissionFeatureRules(props.features, [], true);
      dialogContext.setSnackbar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            {ApplySecurityRulesI18N.unApplySecurityRulesSuccess(props.features.length)}
          </Typography>
        ),
        open: true
      });
    } catch (error) {
      // Close yes-no dialog
      dialogContext.setYesNoDialog({ open: false });

      // Show error dialog
      dialogContext.setErrorDialog({
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        dialogTitle: ApplySecurityRulesI18N.unapplySecurityRulesErrorTitle,
        dialogText: ApplySecurityRulesI18N.unapplySecurityRulesErrorText,
        open: true
      });
    } finally {
      props.onClose();
    }
  };

  return (
    <YesNoDialog
      open={props.isOpen}
      onYes={() => handleRemove()}
      onNo={props.onClose}
      onClose={() => {}}
      dialogTitle="Unsecure all records?"
      dialogText="Are you sure you want to unsecure all records in this submission?"
      dialogContent={
        <Alert severity="error" sx={{ marginTop: 4 }}>
          <AlertTitle>Open access to all records</AlertTitle>
          All users will have unrestricted access to records that have been included in this submission.
        </Alert>
      }
      yesButtonProps={{ color: 'error' }}
      yesButtonLabel="UNSECURE"
      noButtonLabel="CANCEL"
    />
  );
};

export default UnsecureDialog;
