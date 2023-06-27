import { mdiInformationOutline, mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Divider, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import YesNoDialog from 'components/dialog/YesNoDialog';
import { DialogContext, ISnackbarProps } from 'contexts/dialogContext';
import { Formik, FormikProps } from 'formik';
import { useApi } from 'hooks/useApi';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import React, { useContext, useRef, useState } from 'react';
import { ISecurityReason } from './SecurityReasonCategory';
import SecurityReasonSelector, {
  SecurityReasonsInitialValues,
  SecurityReasonsYupSchema
} from './SecurityReasonSelector';
import SelectedDocumentsDataset from './SelectedDocumentsDataset';
import { pluralize as p } from 'utils/Utils';
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

  const dialogContext = useContext(DialogContext);
  const [yesNoDialogOpen, setYesNoDialogOpen] = useState(false);

  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  const [formikRef] = useState(useRef<FormikProps<any>>(null));

  const handleSubmit = async (securityReasons: ISecurityReason[]) => {
    await biohubApi.security.applySecurityReasonsToArtifacts(selectedArtifacts, securityReasons);
  };

  const handleShowSnackBar = (message: string) => {
    showSnackBar({
      snackbarMessage: (
        <>
          <Typography variant="body2" component="div">
            {message}
          </Typography>
        </>
      ),
      open: true
    });
  };

  console.log({ selectedArtifacts })

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
            height: '100%'
          }
        }}>
        <Formik
          innerRef={formikRef}
          initialValues={SecurityReasonsInitialValues}
          validationSchema={SecurityReasonsYupSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={async (values: { securityReasons: ISecurityReason[] }) => {
            await handleSubmit(values.securityReasons);
            handleShowSnackBar(
              `You successfully applied security reasons to ${selectedArtifacts.length} ${p(selectedArtifacts.length, 'file')}.`
            );
            onClose();
          }}>
          {(formikProps) => (
            <>
              <YesNoDialog
                open={yesNoDialogOpen}
                onClose={() => setYesNoDialogOpen(false)}
                onYes={async () => {
                  await formikProps.submitForm();
                  handleShowSnackBar(
                    `You successfully unsecured ${selectedArtifacts.length} ${p(selectedArtifacts.length, 'file')}.`
                  );
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
                <DialogContentText id="alert-dialog-description">
                  {`Search for the security reasons and apply them to the selected ${p(selectedArtifacts.length, 'document')}`}
                </DialogContentText>

                <SelectedDocumentsDataset selectedArtifacts={selectedArtifacts} />

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
