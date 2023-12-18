import { LoadingButton } from '@mui/lab';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useTheme from '@mui/material/styles/useTheme';
import useMediaQuery from '@mui/material/useMediaQuery';
import CompleteSecurityReviewStatusMessage from 'features/submissions/components/PublishSecurityReview/CompleteSecurityReviewStatusMessage';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';

export interface ICompleteSecurityReviewDialogProps {
  submission: SubmissionRecordWithSecurity;
  open: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const CompleteSecurityReviewDialog = (props: ICompleteSecurityReviewDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { submission, open, onComplete, onCancel } = props;

  return (
    <Dialog
      fullScreen={fullScreen}
      maxWidth="md"
      open={open}
      aria-labelledby="complete-security-review-dialog-title"
      aria-describedby="complete-security-review-dialog-description">
      <DialogTitle id="complete-security-review-dialog-title">Publish Submission</DialogTitle>

      <DialogContent>
        <DialogContentText id="complete-security-review-dialog-description">
          Publishing will provide open access to any unsecured records included in this submission. Secured records will remain unavailable.
        </DialogContentText>
        <CompleteSecurityReviewStatusMessage submission={submission} />
        <DialogContentText
          sx={{
            mt: 3
          }}
        >
          Are you sure you want to publish this submission? 
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <LoadingButton onClick={async () => onComplete()} color="primary" variant="contained">
          Publish
        </LoadingButton>
        <Button onClick={() => onCancel()} color="primary" variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CompleteSecurityReviewDialog;
