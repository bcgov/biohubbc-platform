import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import SecureDataAccessRequestForm, { secureDataAccessRequestFormInitialValues, secureDataAccessRequestFormYupSchema } from './SecureDataAccessRequestForm';
import { useRef } from 'react';
import { Formik, FormikProps } from 'formik';
import { ISecureDataAccessRequestForm } from 'interfaces/useSecurityApi.interface';
import { useApi } from 'hooks/useApi';
import { useHistory } from 'react-router';


interface ISecureDataAccessRequestDialogProps {
  open: boolean;
  onClose: () => void;
  artifacts: IArtifact[]
}


const SecureDataAccessRequestDialog = (props: ISecureDataAccessRequestDialogProps) => {
  const biohubApi = useApi();
  const history = useHistory();

  const handleSubmit = async (values: ISecureDataAccessRequestForm) => {
    console.log('handleSubmit()', { values })
    biohubApi.security.sendSecureArtifactAccessRequest({
      ...values,
      pathToParent: history.location.pathname
    });
  }

  const formikRef = useRef<FormikProps<ISecureDataAccessRequestForm>>(null);

  return (
    <Dialog
      // fullScreen={fullScreen}
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
          All secured data and information is governed by the Species and Ecosystems Data and Information Security policy and procedures.
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
            <SecureDataAccessRequestForm artifacts={props.artifacts} />
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
  )
}

export default SecureDataAccessRequestDialog
