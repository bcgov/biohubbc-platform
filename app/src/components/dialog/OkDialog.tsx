import Button, { ButtonProps } from '@mui/material/Button';
import Dialog, { DialogProps } from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { ReactNode } from 'react';

export interface IOkDialogProps {
  /**
   * Optional component to render underneath the dialog text.
   *
   * @type {ReactNode}
   * @memberof IOkDialogProps
   */
  dialogContent?: ReactNode;

  /**
   * The dialog window title text.
   *
   * @type {string}
   * @memberof IOkDialogProps
   */
  dialogTitle: string;

  /**
   * The dialog window body text.
   *
   * @type {string}
   * @memberof IOkDialogProps
   */
  dialogText: string;

  /**
   * Set to `true` to open the dialog, `false` to close the dialog.
   *
   * @type {boolean}
   * @memberof IOkDialogProps
   */
  open: boolean;

  /**
   * Callback fired if the dialog is closed.
   *
   * @memberof IOkDialogProps
   */
  onClose: () => void;

  /**
   * The ok button label.
   *
   * @type {string}
   * @memberof IOkDialogProps
   */
  okButtonLabel?: string;

  /**
   * Optional ok-button props.
   *
   * @type {Partial<ButtonProps>}
   * @memberof IOkDialogProps
   */
  okButtonProps?: Partial<ButtonProps>;

  /**
   * `Dialog` props passthrough.
   *
   * @type {Partial<DialogProps>}
   * @memberof IOkDialogProps
   */
  dialogProps?: Partial<DialogProps>;
}

/**
 * A dialog for displaying a title + message and giving the user a single `Ok` action.
 *
 * @param {*} props
 * @return {*}
 */
const OkDialog: React.FC<React.PropsWithChildren<IOkDialogProps>> = (props) => {
  if (!props.open) {
    return <></>;
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      data-testid="ok-dialog"
      aria-labelledby="ok-dialog-title"
      aria-describedby="ok-dialog-description"
      {...props.dialogProps}>
      <DialogTitle id="ok-dialog-title">{props.dialogTitle}</DialogTitle>
      <DialogContent>
        {props.dialogText && <DialogContentText id="ok-dialog-description">{props.dialogText}</DialogContentText>}
        {props.dialogContent}
      </DialogContent>
      <DialogActions>
        <Button
          data-testid="ok-button"
          onClick={props.onClose}
          color="primary"
          variant="contained"
          {...props.okButtonProps}>
          {props.okButtonLabel ? props.okButtonLabel : 'Ok'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OkDialog;
