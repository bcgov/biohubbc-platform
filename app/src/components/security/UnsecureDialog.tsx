import { Alert, AlertTitle, Typography } from '@mui/material';
import YesNoDialog from 'components/dialog/YesNoDialog';

interface IUnsecureDialogProps {
  submissions: string[];
  isOpen: boolean;
  onClose: () => void;
}
const UnsecureDialog = (props: IUnsecureDialogProps) => {
  return (
    <YesNoDialog
      open={props.isOpen}
      onYes={() => {
        console.log('Unsecure these fools');
      }}
      onNo={props.onClose}
      onClose={() => {}}
      dialogTitle="Unsecure Records?"
      dialogContent={
        <Alert severity="error" sx={{ marginTop: 4 }}>
          <AlertTitle color="black">
            <strong>Open access to all records</strong>
          </AlertTitle>
          <Typography color={'black'}>
            Users will be able to access and download all records included in this dataset
          </Typography>
        </Alert>
      }
      dialogText="Are you sure you want to unsecure this dataset?"
      yesButtonProps={{ color: 'error' }}
      yesButtonLabel="UNSECURE"
      noButtonLabel="CANCEL"
    />
  );
};

export default UnsecureDialog;
