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
  const [errorOccurred, setErrorOccurred] = useState(false);

  const handleSubmit = async (values: ISecureDataAccessRequestForm) => {
    try {
      await biohubApi.security.sendSecureArtifactAccessRequest({
        ...values,
        pathToParent: history.location.pathname
      });
    } catch (error) {
      setErrorOccurred(true);
    } finally {
      props.onClose();
    }
  };

  const formikRef = useRef<FormikProps<ISecureDataAccessRequestForm>>(null);

  return (
    <>
      <ErrorDialog
        dialogTitle="An Error Occurred"
        dialogSubTitle="An error occurred while attempting to submit your request"
        dialogText='If you continue to have difficulties submitting your request, please contact BioHub Support at <a href="mailto: biohub@gov.bc.ca">biohub@gov.bc.ca.</a>'
        open={errorOccurred}
        onClose={() => setErrorOccurred(false)}
        onOk={() => setErrorOccurred(false)}
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
          <Button onClick={() => formikRef.current?.submitForm()} color="primary" variant="contained" autoFocus>
            Submit Request
          </Button>
          <Button onClick={() => props.onClose()} color="primary" variant="outlined" autoFocus>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SecureDataAccessRequestDialog;
