import { mdiExclamation } from '@mdi/js';
import Icon from '@mdi/react';
import { LoadingButton } from '@mui/lab';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useTheme from '@mui/material/styles/useTheme';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Box } from '@mui/system';
import ComponentDialog from 'components/dialog/ComponentDialog';
import { PropsWithChildren, useState } from 'react';

/**
 *
 *
 * @export
 * @interface IManageSecurityReasonsProps
 */
export interface IManageSecurityReasonsProps {
  /**
   * Set to `true` to open the dialog, `false` to close the dialog.
   *
   * @type {boolean}
   * @memberof IManageSecurityReasonsProps
   */
  open: boolean;
  /**
   * Callback fired if the dialog is closed.
   *
   * @memberof IManageSecurityReasonsProps
   */
  onClose: () => void;
  /**
   * Callback fired when submission is made to Biohub
   *
   * @memberof IManageSecurityReasonsProps
   */
  onSubmit: (values: any) => Promise<void>;

  submissionSuccessDialogTitle: string;
  submissionSuccessDialogText: string;
  noSubmissionDataDialogTitle: string;
  noSubmissionDataDialogText: string;
}

/**
 * TODO: FINISH COMPLETE REVIEW DIALOG
 *
 * @param {*} props
 * @return {*}
 */
const CompleteReviewDialog = (props: PropsWithChildren<IManageSecurityReasonsProps>) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showNoInformationDialog, setShowNoInformationDialog] = useState(false);

  return (
    <>
      <ComponentDialog
        dialogTitle={props.submissionSuccessDialogTitle}
        open={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}>
        <DialogContentText id="alert-dialog-description">{props.submissionSuccessDialogText}</DialogContentText>
      </ComponentDialog>

      <ComponentDialog
        dialogTitle={props.noSubmissionDataDialogTitle}
        open={showNoInformationDialog}
        onClose={() => setShowNoInformationDialog(false)}>
        <DialogContentText id="alert-dialog-description">{props.noSubmissionDataDialogText}</DialogContentText>
      </ComponentDialog>

      <Dialog
        fullScreen={fullScreen}
        maxWidth="xl"
        open={props.open}
        aria-labelledby="component-dialog-title"
        aria-describedby="component-dialog-description">
        <>
          <DialogTitle id="component-dialog-title">Complete Review</DialogTitle>

          <DialogContent>
            <DialogContentText id="component-dialog-description">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam at porttitor sem. Aliquam erat volutpat.
              Donec placerat nisl magna, et faucibus arcu condimentum sed.
            </DialogContentText>
            <Box>
              <Icon path={mdiExclamation} size={1} color={'red'} /> {/**TODO: fix color */}
              Open access to all Records Users will be able to access and download all information for this dataset.
            </Box>
          </DialogContent>
          <DialogActions>
            <LoadingButton onClick={props.onSubmit} color="primary" variant="contained">
              Complete
            </LoadingButton>
            <Button onClick={props.onClose} color="primary" variant="outlined">
              CANCEL
            </Button>
          </DialogActions>
        </>
      </Dialog>
    </>
  );
};

export default CompleteReviewDialog;
