import { useMediaQuery, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import { ISecureDataAccessRequestForm } from 'interfaces/useSecurityApi.interface';
import { useRef, useState } from 'react';
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const dialogContext = useDialogContext();
  const formikRef = useRef<FormikProps<ISecureDataAccessRequestForm>>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: ISecureDataAccessRequestForm) => {
    setIsSubmitting(true);
    try {
      await biohubApi.security.sendSecureArtifactAccessRequest({
        ...values,
        pathToParent: location.pathname
      });
      dialogContext.setErrorDialog({
        dialogTitle: 'Request Submitted',
        dialogText:
          'Your secure data access request has been submitted. A BioHub Administrator will contact you shortly.',
        open: true
      });
    } catch (error) {
      dialogContext.setErrorDialog({
        dialogTitle: 'An Error Occurred',
        dialogText: (error as APIError).message,
        open: true
      });
    } finally {
      setIsSubmitting(false);
      props.onClose();
    }
  };

  return (
    <Dialog
      fullScreen={fullScreen}
      maxWidth="md"
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="component-dialog-title"
      aria-describedby="component-dialog-description">
      <DialogTitle id="component-dialog-title">Secure Data Access Request</DialogTitle>
      <DialogContent>
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
        <Button
          loading={isSubmitting}
          onClick={() => formikRef.current?.submitForm()}
          color="primary"
          variant="contained"
          autoFocus>
          Submit Request
        </Button>
        <Button onClick={() => props.onClose()} color="primary" variant="outlined" autoFocus>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SecureDataAccessRequestDialog;
