import { LoadingButton } from '@mui/lab';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useTheme from '@mui/material/styles/useTheme';
import useMediaQuery from '@mui/material/useMediaQuery';
import ComponentDialog from 'components/dialog/ComponentDialog';
import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { Formik, FormikProps } from 'formik';
import { useDialogContext } from 'hooks/useContext';
import { PropsWithChildren, useRef, useState } from 'react';
import yup from 'utils/YupSchema';

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
  onSubmit: (values: IManageSecurityReasonsForm) => Promise<void>;

  submissionSuccessDialogTitle: string;
  submissionSuccessDialogText: string;
  noSubmissionDataDialogTitle: string;
  noSubmissionDataDialogText: string;
}

export interface IManageSecurityReasonsForm {
  security_reasons: number[];
  submission_feature_ids: number[];
}

const manageSecurityReasonsFormInitialValues = {
  security_reasons: [],
  submission_feature_ids: []
};

const manageSecurityReasonsFormSchema = yup.object().shape({
  security_reasons: yup.array().of(yup.number()).required(),
  submission_feature_ids: yup.array().of(yup.number()).required()
});

/**
 * TODO: FINISH MANAGE SECURITY REASONS DIALOG
 *
 * @param {*} props
 * @return {*}
 */
const ManageSecurityReasonsDialog = (props: PropsWithChildren<IManageSecurityReasonsProps>) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const dialogContext = useDialogContext();

  const defaultErrorDialogProps = {
    onClose: () => {
      dialogContext.setErrorDialog({ open: false });
    },
    onOk: () => {
      dialogContext.setErrorDialog({ open: false });
    }
  };

  const [formikRef] = useState(useRef<FormikProps<IManageSecurityReasonsForm>>(null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showNoInformationDialog, setShowNoInformationDialog] = useState(false);

  const showErrorDialog = (textDialogProps?: Partial<IErrorDialogProps>) => {
    dialogContext.setErrorDialog({ ...defaultErrorDialogProps, ...textDialogProps, open: true });
  };

  const handleSubmit = (values: IManageSecurityReasonsForm) => {
    if (JSON.stringify(values) === JSON.stringify(manageSecurityReasonsFormInitialValues)) {
      showErrorDialog({
        dialogTitle: 'error title',
        dialogText: 'error text'
      });

      return;
    }

    setIsSubmitting(true);
    props
      .onSubmit(values)
      .then(() => {
        setShowSuccessDialog(true);
      })
      .catch(() => {
        setShowSuccessDialog(false);
        showErrorDialog({
          dialogTitle: 'error title',
          dialogText: 'error text'
        });
      })
      .finally(() => {
        setIsSubmitting(false);
        props.onClose();
      });
  };

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
        <Formik<IManageSecurityReasonsForm>
          innerRef={formikRef}
          initialValues={manageSecurityReasonsFormInitialValues}
          validationSchema={manageSecurityReasonsFormSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={handleSubmit}>
          {(formikProps) => (
            <>
              <DialogTitle id="component-dialog-title">Manage Security Reasons</DialogTitle>

              <DialogContent>
                <DialogContentText id="component-dialog-description">
                  Manage security reasons for content and data submitted as part of this dataset.
                </DialogContentText>
                <DialogContentText id="component-dialog-title">
                  <strong>Select Security Reasons</strong>
                </DialogContentText>
                <DialogContentText id="component-dialog-description">
                  Select the reasons this dataset should be secured.
                </DialogContentText>
                dropdown
              </DialogContent>
              <DialogActions>
                <LoadingButton
                  onClick={formikProps.submitForm}
                  color="primary"
                  variant="contained"
                  disabled={formikProps.values === manageSecurityReasonsFormInitialValues || isSubmitting}
                  loading={isSubmitting}>
                  APPLY
                </LoadingButton>
                <Button onClick={props.onClose} color="primary" variant="outlined" disabled={isSubmitting}>
                  CANCEL
                </Button>
              </DialogActions>
            </>
          )}
        </Formik>
      </Dialog>
    </>
  );
};

export default ManageSecurityReasonsDialog;
