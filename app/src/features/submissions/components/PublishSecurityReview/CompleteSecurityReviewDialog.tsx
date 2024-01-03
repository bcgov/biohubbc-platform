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
      <DialogTitle id="complete-security-review-dialog-title">Complete Security Review</DialogTitle>

      <DialogContent>
        <DialogContentText id="complete-security-review-dialog-description">
          Completing the security review for this submission will enable it to be published. Security reviews can be
          reopened at anytime.
        </DialogContentText>
        <CompleteSecurityReviewStatusMessage submission={submission} />
      </DialogContent>
      <DialogActions>
        <LoadingButton onClick={async () => onComplete()} color="primary" variant="contained">
          Complete
        </LoadingButton>
        <Button onClick={() => onCancel()} color="primary" variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CompleteSecurityReviewDialog;
