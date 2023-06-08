import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import { Formik, FormikProps } from 'formik';
import SecureDataAccessRequestForm, { ISecureDataAccessRequestForm, secureDataAccessRequestFormInitialValues, secureDataAccessRequestFormYupSchema } from './SecureDataAccessRequestForm';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

interface ISecureDataAccessRequestDialogProps {
  open: boolean;
  onClose: () => void;
  artifacts: IArtifact[]
}


const SecureDataAccessRequestDialog = (props: ISecureDataAccessRequestDialogProps) => {
  //const 

  const formikRef = useRef<FormikProps<ISecureDataAccessRequestForm>>(null);

  const columns: GridColDef<IArtifact>[] = [
    {
      field: 'file_name',
      headerName: 'Title',
      flex: 2,
      disableColumnMenu: true
    },
    {
      field: 'file_type',
      headerName: 'Type',
      flex: 1
    }
  ];

  return (
    <Dialog
      // fullScreen={fullScreen}
      maxWidth="xl"
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

        <Box py={2}>
          <Typography variant="body1" sx={{ textTransform: 'uppercase' }}>
            <strong>Documents You Are Requesting</strong>
          </Typography>
          <Box py={2}>
            <Paper>
              <DataGrid
                getRowId={(row) => row.artifact_id}
                autoHeight
                rows={props.artifacts}
                columns={columns}
                checkboxSelection
                disableRowSelectionOnClick
                disableColumnSelector
                disableColumnFilter
                disableColumnMenu
                sortingOrder={['asc', 'desc']}
                />
              </Paper>
          </Box>
        </Box>

        <Box>
          <Formik
            innerRef={formikRef}
            initialValues={secureDataAccessRequestFormInitialValues}
            validationSchema={secureDataAccessRequestFormYupSchema}
            validateOnBlur={true}
            validateOnChange={false}
            enableReinitialize={true}
            onSubmit={() => { }}>
            <SecureDataAccessRequestForm />
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
