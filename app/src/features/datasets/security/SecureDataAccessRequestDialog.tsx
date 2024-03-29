import LoadingButton from '@mui/lab/LoadingButton';
import { useMediaQuery, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { ErrorDialog } from 'components/dialog/ErrorDialog';
import { Formik, FormikProps } from 'formik';
import { useApi } from 'hooks/useApi';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import { ISecureDataAccessRequestForm } from 'interfaces/useSecurityApi.interface';
import { useRef, useState } from 'react';
import { useHistory } from 'react-router';
import SecureDataAccessRequestForm, {
  secureDataAccessRequestFormInitialValues,
  secureDataAccessRequestFormYupSchema
} from './SecureDataAccessRequestForm';

interface ISecureDataAccessRequestDialogProps {
  open: boolean;
  onClose: () => void;
  artifacts: IArtifact[];
  initialArtifactSelection: number[];
}

const SecureDataAccessRequestDialog = (props: ISecureDataAccessRequestDialogProps) => {
  const biohubApi = useApi();
  const history = useHistory();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: ISecureDataAccessRequestForm) => {
    setIsSubmitting(true);
    try {
      await biohubApi.security.sendSecureArtifactAccessRequest({
        ...values,
        pathToParent: history.location.pathname
      });
      setShowSuccessDialog(true);
    } catch (error) {
      setShowErrorDialog(true);
    } finally {
      setIsSubmitting(false);
      props.onClose();
    }
  };

  const formikRef = useRef<FormikProps<ISecureDataAccessRequestForm>>(null);

  return (
    <>
      <ErrorDialog
        // TODO Replace this with a "Success" Dialog at some point
        dialogTitle="Request Submitted"
        dialogSubTitle="Your secure data success request has been submitted"
        dialogText="A BioHub Administrator will contact you shortly."
        open={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        onOk={() => setShowSuccessDialog(false)}
      />

      <ErrorDialog
        dialogTitle="An Error Occurred"
        dialogSubTitle="An error occurred while attempting to submit your request"
        dialogText='If you continue to have difficulties submitting your request, please contact BioHub Support at <a href="mailto: biohub@gov.bc.ca">biohub@gov.bc.ca.</a>'
        open={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        onOk={() => setShowErrorDialog(false)}
      />

      <Dialog
        fullScreen={fullScreen}
        maxWidth="md"
        open={props.open}
        onClose={props.onClose}
        aria-labelledby="component-dialog-title"
        aria-describedby="component-dialog-description">
        <DialogTitle id="component-dialog-title">Secure Data Access Request</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Request access to the following documents by filling in and submitting the secured data access form below.
          </DialogContentText>
          <DialogContentText id="alert-dialog-description">
            All secured data and information is governed by the Species and Ecosystems Data and Information Security
            policy and procedures.
          </DialogContentText>

          <Box>
            <Formik
              innerRef={formikRef}
              initialValues={secureDataAccessRequestFormInitialValues}
              validationSchema={secureDataAccessRequestFormYupSchema}
              validateOnBlur={true}
              validateOnChange={false}
              enableReinitialize={true}
              onSubmit={handleSubmit}>
              <SecureDataAccessRequestForm
                artifacts={props.artifacts}
                initialArtifactSelection={props.initialArtifactSelection}
              />
            </Formik>
          </Box>
        </DialogContent>
        <DialogActions>
          <LoadingButton
            loading={isSubmitting}
            onClick={() => formikRef.current?.submitForm()}
            color="primary"
            variant="contained"
            autoFocus>
            Submit Request
          </LoadingButton>
          <Button onClick={() => props.onClose()} color="primary" variant="outlined" autoFocus>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SecureDataAccessRequestDialog;
