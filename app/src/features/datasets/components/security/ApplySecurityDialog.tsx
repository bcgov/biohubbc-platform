import { Box, Divider } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Formik, FormikProps } from 'formik';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import React, { useRef, useState } from 'react';
import SecurityReasonSelector, {
  SecurityReasonsInitialValues,
  SecurityReasonsYupSchema
} from './SecurityReasonSelector';
import SelectedDocumentsDataset from './SelectedDocumentsDataset';

export interface IApplySecurityDialog {
  selectedArtifacts: IArtifact[];
  open: boolean;
  onClose: () => void;
}

/**
 * Publish button.
 *
 * @return {*}
 */
const ApplySecurityDialog: React.FC<IApplySecurityDialog> = (props) => {
  const { selectedArtifacts, open, onClose } = props;

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('xl'));

  const [formikRef] = useState(useRef<FormikProps<any>>(null));

  return (
    <>
      <Dialog
        fullScreen={fullScreen}
        maxWidth="xl"
        open={open}
        aria-labelledby="component-dialog-title"
        aria-describedby="component-dialog-description"
        PaperProps={{
          sx: {
            width: '100%',
            height: '100%',
            p: 2
          }
        }}>
        <Formik
          innerRef={formikRef}
          initialValues={SecurityReasonsInitialValues}
          validationSchema={SecurityReasonsYupSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={(values) => {
            console.log('values', values);
          }}>
          {(formikProps) => (
            <>
              <DialogTitle id="component-dialog-title">Apply Security Reasons</DialogTitle>
              <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box sx={{ mb: 2 }}>
                  <DialogContentText id="alert-dialog-description">
                    Search for the security reasons and apply them to the selected doument(s).
                  </DialogContentText>

                  <SelectedDocumentsDataset selectedArtifacts={selectedArtifacts} />
                </Box>

                <SecurityReasonSelector selectedArtifacts={selectedArtifacts} />
              </DialogContent>
              <Divider />
              <DialogActions>
                <Button onClick={formikProps.submitForm} color="primary" variant="contained" autoFocus>
                  Submit
                </Button>
                <Button onClick={onClose} color="primary" variant="outlined" autoFocus>
                  Cancel
                </Button>
              </DialogActions>
            </>
          )}
        </Formik>
      </Dialog>
    </>
  );
};

export default ApplySecurityDialog;
