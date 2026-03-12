import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { ErrorDialog, IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { IOkDialogProps, OkDialog } from 'components/dialog/OkDialog';
import YesNoDialog, { IYesNoDialogProps } from 'components/dialog/YesNoDialog';
import { createContext, ReactNode, useState } from 'react';

export interface IDialogContext {
  /**
   * Set the yes no dialog props.
   *
   * Note: Any props that are not provided, will default to whatever value was previously set (or the default value)
   *
   * @memberof IDialogContext
   */
  setYesNoDialog: (props: Partial<IYesNoDialogProps>) => void;
  /**
   * The current yes no dialog props.
   *
   * @type {IYesNoDialogProps}
   * @memberof IDialogContext
   */
  yesNoDialogProps: IYesNoDialogProps;
  /**
   * Set the error dialog props.
   *
   * Note: Any props that are not provided, will default to whatever value was previously set (or the default value)
   *
   * @memberof IDialogContext
   */
  setErrorDialog: (props: Partial<IErrorDialogProps>) => void;
  /**
   * The current error dialog props.
   *
   * @type {IErrorDialogProps}
   * @memberof IDialogContext
   */
  errorDialogProps: IErrorDialogProps;
  /**
   * Set the ok dialog props.
   *
   * Note: Any props that are not provided, will default to whatever value was previously set (or the default value)
   *
   * @memberof IDialogContext
   */
  setOkDialog: (props: Partial<IOkDialogProps>) => void;
  /**
   * The current ok dialog props.
   *
   * @type {IOkDialogProps}
   * @memberof IDialogContext
   */
  okDialogProps: IOkDialogProps;
  /**
   * Set the snackbar props.
   *
   * Note: Any props that are not provided, will default to whatever value was previously set (or the default value)
   *
   * @memberof IDialogContext
   */
  setSnackbar: (props: Partial<ISnackbarProps>) => void;
  /**
   * The current snackbar props.
   *
   * @type {ISnackbarProps}
   * @memberof IDialogContext
   */
  snackbarProps: ISnackbarProps;
}

export interface ISnackbarProps {
  snackbarMessage: ReactNode;
  open: boolean;
}

export const defaultYesNoDialogProps: IYesNoDialogProps = {
  dialogTitle: '',
  dialogText: '',
  open: false,
  onClose: () => {
    // default do nothing
  },
  onNo: () => {
    // default do nothing
  },
  onYes: () => {
    // default do nothing
  }
};

export const defaultErrorDialogProps: IErrorDialogProps = {
  dialogTitle: '',
  dialogText: '',
  open: false,
  onClose: () => {
    // default do nothing
  },
  onOk: () => {
    // default do nothing
  }
};

export const defaultOkDialogProps: IOkDialogProps = {
  dialogTitle: '',
  dialogText: '',
  open: false,
  onClose: () => {
    // default do nothing
  }
};

export const defaultSnackbarProps: ISnackbarProps = {
  snackbarMessage: '',
  open: false
};

export const DialogContext = createContext<IDialogContext>({
  setYesNoDialog: () => {
    // default do nothing
  },
  yesNoDialogProps: defaultYesNoDialogProps,
  setErrorDialog: () => {
    // default do nothing
  },
  errorDialogProps: defaultErrorDialogProps,
  setOkDialog: () => {
    // default do nothing
  },
  okDialogProps: defaultOkDialogProps,
  setSnackbar: () => {
    // default do nothing
  },
  snackbarProps: defaultSnackbarProps
});

/**
 * Wraps the provided children in a context that provides various modal dialogs/popups.
 *
 * @param {*} props
 * @return {*}
 */
export const DialogContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const [yesNoDialogProps, setYesNoDialogProps] = useState<IYesNoDialogProps>(defaultYesNoDialogProps);

  const [errorDialogProps, setErrorDialogProps] = useState<IErrorDialogProps>(defaultErrorDialogProps);
  const [okDialogProps, setOkDialogProps] = useState<IOkDialogProps>(defaultOkDialogProps);

  const [snackbarProps, setSnackbarProps] = useState<ISnackbarProps>(defaultSnackbarProps);

  const setYesNoDialog = function (partialProps: Partial<IYesNoDialogProps>) {
    setYesNoDialogProps({ ...yesNoDialogProps, ...partialProps });
  };

  const setSnackbar = function (partialProps: Partial<ISnackbarProps>) {
    setSnackbarProps({ ...snackbarProps, ...partialProps });
  };

  const setErrorDialog = function (partialProps: Partial<IErrorDialogProps>) {
    setErrorDialogProps({ ...errorDialogProps, ...partialProps });
  };

  const setOkDialog = function (partialProps: Partial<IOkDialogProps>) {
    setOkDialogProps({ ...okDialogProps, ...partialProps });
  };

  return (
    <DialogContext.Provider
      value={{
        setYesNoDialog,
        yesNoDialogProps,
        setErrorDialog,
        errorDialogProps,
        setOkDialog,
        okDialogProps,
        setSnackbar,
        snackbarProps
      }}>
      {props.children}
      <YesNoDialog {...yesNoDialogProps} />
      <ErrorDialog {...errorDialogProps} />
      <OkDialog {...okDialogProps} />
      <Snackbar
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center'
        }}
        open={snackbarProps.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ open: false })}
        message={snackbarProps.snackbarMessage}
        action={
          <IconButton size="small" aria-label="close" color="inherit" onClick={() => setSnackbar({ open: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </DialogContext.Provider>
  );
};
