import { mdiAlphaX, mdiInformationOutline, mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Divider, IconButton } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import YesNoDialog from 'components/dialog/YesNoDialog';
import { Formik, FormikProps } from 'formik';
import { useApi } from 'hooks/useApi';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import React, { useRef, useState } from 'react';
import { ISecurityReason } from './SecurityReasonCategory';
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
  const biohubApi = useApi();
  const { selectedArtifacts, open, onClose } = props;

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('xl'));

  const [yesNoDialogOpen, setYesNoDialogOpen] = useState(false);

  const [applySecurityCompleted, setApplySecurityCompleted] = useState(false);
  const [applySecurityText, setApplySecurityText] = useState('');

  const [formikRef] = useState(useRef<FormikProps<any>>(null));

  const handleSubmit = async (securityReasons: ISecurityReason[]) => {
    await biohubApi.security.applySecurityReasonsToArtifacts(selectedArtifacts, securityReasons);
  };

  return (
    <>
      <Dialog
        maxWidth="sm"
        open={applySecurityCompleted}
        aria-labelledby="component-dialog-title"
        aria-describedby="component-dialog-description">
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'row', justifyContent: 'start' }}>
          <DialogContentText id="alert-dialog-description" sx={{ py: 2 }}>
            {applySecurityText}
          </DialogContentText>
          <IconButton onClick={() => setApplySecurityCompleted(false)} color="primary" aria-label="close">
            <Icon path={mdiAlphaX} size={1.5} />
          </IconButton>
        </Box>
      </Dialog>

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
          onSubmit={(values: { securityReasons: ISecurityReason[] }) => {
            handleSubmit(values.securityReasons);
            setApplySecurityText(
              `You successfully applied security reasons to the file${selectedArtifacts.length > 1 && 's'}.`
            );
            setApplySecurityCompleted(true);
            onClose();
          }}>
          {(formikProps) => (
            <>
              <YesNoDialog
                open={yesNoDialogOpen}
                onClose={() => setYesNoDialogOpen(false)}
                onYes={async () => {
                  await formikProps.submitForm();
                  setApplySecurityText(`You successfully  unsecured the file${selectedArtifacts.length > 1 && 's'}.`);
                  setApplySecurityCompleted(true);
                  setYesNoDialogOpen(false);
                }}
                onNo={() => setYesNoDialogOpen(false)}
                dialogTitle=""
                dialogText=""
                dialogContent={
                  <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignContent: 'center' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
                      <Icon path={mdiInformationOutline} size={5} color={'#a12622'} />
                    </Box>
                    <DialogTitle id="component-dialog-title" align={'center'}>
                      Warning
                    </DialogTitle>
                    <DialogContentText id="alert-dialog-description" align={'center'} sx={{ py: 2 }}>
                      You are going to make this document available to the public. This document can be downloaded.
                      Also, if there are any security reasons, they will be removed.
                    </DialogContentText>
                    <DialogContentText id="alert-dialog-description" align={'center'}>
                      <strong>Are you sure you would like to proceed?</strong>
                    </DialogContentText>
                  </Box>
                }
              />

              <DialogTitle id="component-dialog-title">Apply Security Reasons</DialogTitle>
              <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box sx={{ mb: 2 }}>
                  <DialogContentText id="alert-dialog-description">
                    Search for the security reasons and apply them to the selected document
                    {selectedArtifacts.length > 1 && 's'}.
                  </DialogContentText>

                  <SelectedDocumentsDataset selectedArtifacts={selectedArtifacts} />
                </Box>

                <SecurityReasonSelector />
              </DialogContent>
              <Divider />
              <DialogActions>
                <Button
                  title="Apply Security Rules"
                  variant="contained"
                  color="primary"
                  disabled={formikProps.values.securityReasons.length === 0}
                  startIcon={<Icon path={mdiLock} size={1} />}
                  onClick={formikProps.submitForm}>
                  Apply Security
                </Button>

                <Button
                  title="No Security Required"
                  variant="contained"
                  color="primary"
                  startIcon={<Icon path={mdiLock} size={1} />}
                  onClick={() => {
                    formikProps.setFieldValue('securityReasons', SecurityReasonsInitialValues.securityReasons);
                    setYesNoDialogOpen(true);
                  }}>
                  No Security Required
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
