import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import React from 'react';
import SecurityReasonSelector from './SecurityReasonSelector';
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
  console.log('selectedArtifacts', selectedArtifacts);

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('xl'));

  return (
    <>
      <Dialog
        fullScreen={fullScreen}
        maxWidth="xl"
        open={open}
        aria-labelledby="component-dialog-title"
        aria-describedby="component-dialog-description">
        <DialogTitle id="component-dialog-title">Apply Security Reasons</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <strong>Search for the security reasons and apply them to the selected doument(s). </strong>
          </DialogContentText>

          <Box mt={2}>
            <SelectedDocumentsDataset selectedArtifacts={selectedArtifacts} />
          </Box>

          <Box mt={2}>
            <SecurityReasonSelector />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              console.log('submit');
            }}
            color="primary"
            variant="contained"
            autoFocus>
            Submit
          </Button>
          <Button onClick={onClose} color="primary" variant="outlined" autoFocus>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ApplySecurityDialog;
