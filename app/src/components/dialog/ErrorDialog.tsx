import { Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import { makeStyles } from '@mui/styles';
import DOMPurify from 'dompurify';
import { useState } from 'react';

const useStyles = makeStyles((theme: Theme) => ({
  dialogSubTitle: {
    fontSize: '14px',
    color: '#787f81',
    fontWeight: 'bold'
  }
}));

export interface IErrorDialogProps {
  /**
   * The dialog window title text.
   *
   * @type {string}
   * @memberof IErrorDialogProps
   */
  dialogTitle: string;
  /**
   * The dialog window title sub text.
   *
   * @type {string}
   * @memberof IErrorDialogProps
   */
  dialogSubTitle?: string;
  /**
   * The dialog window body text.
   *
   * @type {string}
   * @memberof IErrorDialogProps
   */
  dialogText: string;
  /**
   * The dialog window human friendly error (optional).
   *
   * @type {string}
   * @memberof IErrorDialogProps
   */
  dialogError?: string;
  /**
   * The dialog window technical error details (optional).
   *
   * @type {((string | object)[])}
   * @memberof IErrorDialogProps
   */
  dialogErrorDetails?: (string | object)[];
  /**
   * Set to `true` to open the dialog, `false` to close the dialog.
   *
   * @type {boolean}
   * @memberof IErrorDialogProps
   */
  open: boolean;
  /**
   * Callback fired if the dialog is closed.
   *
   * @memberof IErrorDialogProps
   */
  onClose: () => void;
  /**
   * Callback fired if the 'Ok' button is clicked.
   *
   * @memberof IErrorDialogProps
   */
  onOk: () => void;
}

/**
 * A dialog for displaying a title + message + optional error message, and just giving the user an `Ok` button to
 * acknowledge it.
 *
 * @param {*} props
 * @return {*}
 */
export const ErrorDialog: React.FC<React.PropsWithChildren<IErrorDialogProps>> = (props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const classes = useStyles();

  const ErrorDetailsList = (errorProps: { errors: (string | object)[] }) => {
    const items = errorProps.errors.map((error, index) => {
      if (typeof error === 'string') {
        return <li key={index}>{error}</li>;
      }

      return <li key={index}>{JSON.stringify(error)}</li>;
    });

    return <ul>{items}</ul>;
  };

  if (!props.open) {
    return <></>;
  }

  return (
    <Box>
      <Dialog
        fullWidth
        open={props.open}
        onClose={props.onClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description">
        <DialogTitle id="alert-dialog-title">{props.dialogTitle}</DialogTitle>
        <DialogContent>
          {props.dialogSubTitle && (
            <DialogContentText mb={'1em'} className={classes.dialogSubTitle} id="alert-dialog-sub-title">
              {props.dialogSubTitle}
            </DialogContentText>
          )}
          <DialogContentText id="alert-dialog-description">
            <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(props.dialogText as string) }} />
          </DialogContentText>
        </DialogContent>
        {props.dialogError && (
          <DialogContent>
            <DialogContentText id="alert-dialog-description">{props.dialogError}</DialogContentText>
            {!!props?.dialogErrorDetails?.length && (
              <>
                <Button color="primary" onClick={() => setIsExpanded(!isExpanded)}>
                  {(isExpanded && 'Hide detailed error message') || 'Show detailed error message'}
                </Button>
                <Collapse in={isExpanded}>
                  <ErrorDetailsList errors={props.dialogErrorDetails} />
                </Collapse>
              </>
            )}
          </DialogContent>
        )}
        <Divider />
        <DialogActions>
          <Button onClick={props.onOk} color="primary" variant="contained" autoFocus>
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
