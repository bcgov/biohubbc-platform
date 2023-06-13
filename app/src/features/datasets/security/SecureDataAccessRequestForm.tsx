import { DialogContentText, FormControl, FormControlLabel, FormHelperText, Radio, RadioGroup, Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { makeStyles } from '@mui/styles';
import CustomTextField from 'components/fields/CustomTextField';
import yup from 'utils/YupSchema';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import { useFormikContext } from 'formik';
import { ISecureDataAccessRequestForm } from 'interfaces/useSecurityApi.interface';

const useStyles = makeStyles((theme: Theme) => ({
  subheader: {
    textTransform: 'uppercase'
  },
  dataGrid: {
    borderWidth: 1
  }
}));

export const secureDataAccessRequestFormInitialValues: ISecureDataAccessRequestForm = {
  fullName: '',
  emailAddress: '',
  phoneNumber: '',
  reasonDescription: '',
  hasSignedAgreement: undefined as unknown as boolean,
  artifactIds: [],
  pathToParent: ''
};

export const secureDataAccessRequestFormYupSchema = yup.object().shape({
  fullName: yup.string().max(50, 'Cannot exceed 50 characters').required('Full Name is Required'),
  emailAddress: yup
    .string()
    .max(500, 'Cannot exceed 500 characters')
    .email('Must be a valid email address')
    .required('Email Address is Required'),
  phoneNumber: yup.string().max(300, 'Cannot exceed 300 characters').required('Phone Number is Required'),
  reasonDescription: yup.string().max(3000, 'Cannot exceed 3000 characters').required('Description is Required'),
  hasSignedAgreement: yup.boolean().required('Confidentiality Agreement is Required'),
  selectedArtifacts: yup.array().min(1, 'Must select at least one artifact')
});

interface ISecureDataAccessRequestFormProps {
  artifacts: IArtifact[];
}

/**
 * Publish button.
 *
 * @return {*}
 */
const SecureDataAccessRequestForm = (props: ISecureDataAccessRequestFormProps) => {
  const classes = useStyles();
  const formikProps = useFormikContext<ISecureDataAccessRequestForm>();

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

  const onChangeSelection = (rowSelectionModel: GridRowSelectionModel) => {
    formikProps.setFieldValue('artifactIds', rowSelectionModel);
  }

  const onChangeAgreementConfirmation = (event: React.ChangeEvent<HTMLInputElement>) => {
    formikProps.setFieldValue('hasSignedAgreement', event.target.value !== 'false');
  }

  const agreementSignedError = Boolean(formikProps.touched['hasSignedAgreement'] && formikProps.errors['hasSignedAgreement'])

  return (
    
      <>
        <Typography variant="body1" sx={{ textTransform: 'uppercase' }}>
          <strong>Documents You Are Requesting</strong>
        </Typography>
        <Box py={2}>
          <Paper elevation={0}>
            <DataGrid
              className={classes.dataGrid}
              getRowId={(row) => row.artifact_id}
              autoHeight
              rows={props.artifacts}
              columns={columns}
              checkboxSelection
              disableRowSelectionOnClick
              disableColumnSelector
              disableColumnFilter
              disableColumnMenu
              disableVirtualization
              disableDensitySelector
              hideFooter
              sortingOrder={['asc', 'desc']}
              onRowSelectionModelChange={onChangeSelection}
              />
            </Paper>
        </Box>

        <Typography variant="body1" className={classes.subheader}>
          <strong>Contact Details</strong>
        </Typography>

        <Box py={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <CustomTextField
                name="fullName"
                label="Full Name"
                other={{
                  required: true
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <CustomTextField
                name="emailAddress"
                label="Email Address"
                other={{
                  required: true
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <CustomTextField
                name="phoneNumber"
                label="Phone Number"
                other={{
                  required: true
                }}
              />
            </Grid>
          </Grid>
        </Box>

        <Box mt={2}>
          <Typography variant="body1" className={classes.subheader}>
            <strong>Reason for Request</strong>
          </Typography>
          <DialogContentText variant="body1">Please be specific in describing your request.</DialogContentText>
          <Box py={2}>
            <CustomTextField
              name="reasonDescription"
              label="Description"
              other={{ multiline: true, required: true, rows: 4 }}
            />
          </Box>
        </Box>

        <Box mt={2}>
          <FormControl
            required={true}
            component="fieldset"
            error={agreementSignedError}
          >
            <Typography component="legend" variant="h5">
              Confidentiality Agreement
            </Typography>
            <Typography color="textSecondary">
              Do you have a signed and current Confidentiality and Non-Reproduction Agreement?
            </Typography>
            <Box mt={2} pl={1}>
              <RadioGroup
                name="hasSignedAgreement"
                value={formikProps.values.hasSignedAgreement}
                onChange={onChangeAgreementConfirmation}
              >
                <FormControlLabel
                  value="true"
                  control={<Radio required={true} color="primary" size="small" />}
                  label="Yes"
                />
                <FormControlLabel
                  value="false"
                  control={<Radio required={true} color="primary" size="small" />}
                  label="No"
                />
                <FormHelperText>{formikProps.errors['hasSignedAgreement']}</FormHelperText>
              </RadioGroup>
            </Box>
          </FormControl>
        </Box>
      </>
  );
};

export default SecureDataAccessRequestForm;
