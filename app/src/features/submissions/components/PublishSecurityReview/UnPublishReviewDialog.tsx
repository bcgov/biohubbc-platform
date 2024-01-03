import { LoadingButton } from '@mui/lab';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useTheme from '@mui/material/styles/useTheme';
import useMediaQuery from '@mui/material/useMediaQuery';

export interface IUnPublishReviewDialogProps {
  open: boolean;
  onRemove: () => void;
  onCancel: () => void;
}

const UnPublishReviewDialog = (props: IUnPublishReviewDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { open, onRemove, onCancel } = props;

  return (
    <Dialog
      fullScreen={fullScreen}
      maxWidth="md"
      open={open}
      aria-labelledby="remove-security-review-dialog-title"
      aria-describedby="remove-security-review-dialog-description">
      <DialogTitle id="remove-security-review-dialog-title">Unpublish submission?</DialogTitle>

      <DialogContent>
        <DialogContentText id="remove-security-review-dialog-description">
          This submission will no longer be available to users. Are you sure you want to proceed?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <LoadingButton onClick={async () => onRemove()} color="primary" variant="contained">
          Unpublish
        </LoadingButton>
        <Button onClick={() => onCancel()} color="primary" variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UnPublishReviewDialog;
