import LoadingButton, { LoadingButtonProps } from '@mui/lab/LoadingButton';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useTheme from '@mui/material/styles/useTheme';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ReactNode } from 'react';

export interface IYesNoDialogProps {
  /**
   * optional component to render underneath the dialog text.
   *
   * @type {ReactNode}
   * @memberof IYesNoDialogProps
   */
  dialogContent?: ReactNode;
  /**
   * The dialog window title text.
   *
   * @type {string}
   * @memberof IYesNoDialogProps
   */
  dialogTitle: string;
  /**
   * The dialog window body text.
   *
   * @type {string}
   * @memberof IYesNoDialogProps
   */
  dialogText: string;
  /**
   * Set to `true` to open the dialog, `false` to close the dialog.
   *
   * @type {boolean}
   * @memberof IYesNoDialogProps
   */
  open: boolean;
  /**
   * Callback fired if the dialog is closed.
   *
   * @memberof IYesNoDialogProps
   */
  onClose: () => void;
  /**
   * Callback fired if the 'No' button is clicked.
   *
   * @memberof IYesNoDialogProps
   */
  onNo: () => void;
  /**
   * Callback fired if the 'Yes' button is clicked.
   *
   * @memberof IYesNoDialogProps
   */
  onYes: () => void;

  /**
   * The yes button label.
   *
   * @type {string}
   * @memberof IYesNoDialogProps
   */
  yesButtonLabel?: string;

  /**
   * The no button label.
   *
   * @type {string}
   * @memberof IYesNoDialogProps
   */
  noButtonLabel?: string;

  /**
   * Optional yes-button props
   *
   * @type {Partial<LoadingButtonProps>}
   * @memberof IYesNoDialogProps
   */
  yesButtonProps?: Partial<LoadingButtonProps>;

  /**
   * Optional no-button props
   *
   * @type {Partial<LoadingButtonProps>}
   * @memberof IYesNoDialogProps
   */
  noButtonProps?: Partial<LoadingButtonProps>;
}

/**
 * A dialog for displaying a title + message (typically a question), and giving the user the option to say
 * `Yes` or `No`.
 *
 * @param {*} props
 * @return {*}
 */
const YesNoDialog: React.FC<React.PropsWithChildren<IYesNoDialogProps>> = (props) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  if (!props.open) {
    return <></>;
  }

  return (
    <Dialog
      fullWidth
      fullScreen={fullScreen}
      maxWidth="md"
      open={props.open}
      onClose={props.onClose}
      data-testid="yes-no-dialog"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description">
      <DialogTitle id="alert-dialog-title">{props.dialogTitle}</DialogTitle>
      <DialogContent>
        {props.dialogText && <DialogContentText id="alert-dialog-description">{props.dialogText}</DialogContentText>}
        {props.dialogContent}
      </DialogContent>
      <DialogActions>
        <LoadingButton
          data-testid="yes-button"
          onClick={props.onYes}
          color="primary"
          variant="contained"
          {...props.yesButtonProps}>
          {props.yesButtonLabel ? props.yesButtonLabel : 'Yes'}
        </LoadingButton>

        <LoadingButton
          data-testid="no-button"
          onClick={props.onNo}
          color="primary"
          variant="outlined"
          {...props.noButtonProps}>
          {props.noButtonLabel ? props.noButtonLabel : 'No'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default YesNoDialog;
