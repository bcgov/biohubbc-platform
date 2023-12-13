import { Alert, AlertTitle, Typography } from '@mui/material';
import YesNoDialog from 'components/dialog/YesNoDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { DialogContext } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { useContext } from 'react';
import { useParams } from 'react-router';

interface IUnsecureDialogProps {
  features: number[];
  isOpen: boolean;
  onClose: () => void;
}
const UnsecureDialog = (props: IUnsecureDialogProps) => {
  const api = useApi();
  const dialogContext = useContext(DialogContext);
  const { submission_uuid } = useParams<{ submission_uuid: string }>();
  const handleRemove = async () => {
    try {
      await api.submissions.applySubmissionFeatureRules(submission_uuid, props.features, [], true);
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
      dialogTitle="Unsecure Records?"
      dialogContent={
        <Alert severity="error" sx={{ marginTop: 4 }}>
          <AlertTitle color="black">
            <strong>Open access to all records</strong>
          </AlertTitle>
          <Typography color={'black'}>
            Users will be able to access and download all records included in this dataset
          </Typography>
        </Alert>
      }
      dialogText="Are you sure you want to unsecure this dataset?"
      yesButtonProps={{ color: 'error' }}
      yesButtonLabel="UNSECURE"
      noButtonLabel="CANCEL"
    />
  );
};

export default UnsecureDialog;
