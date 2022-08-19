import { Alert, Box, Button, Grid, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';
import FileUpload from 'components/attachments/FileUpload';
import { IUploadHandler } from 'components/attachments/FileUploadItem';
import CustomTextField from 'components/fields/CustomTextField';
import { AttachmentValidExtensions } from 'constants/attachments';
import { useFormikContext } from 'formik';
import { Feature } from 'geojson';
import { get } from 'lodash-es';
import React from 'react';
import { handleGPXUpload, handleKMLUpload, handleShapefileUpload } from 'utils/mapUploadUtils';
import yup from 'utils/YupSchema';

const useStyles = makeStyles((theme) => ({
  actionButton: {
    minWidth: '6rem',
    '& + button': {
      marginLeft: '0.5rem'
    }
  }
}));

export interface IBoundaryUpload {
  boundary_name: string;
  geometry: Feature[];
}

export const BoundaryUploadInitialValues: IBoundaryUpload = {
  boundary_name: '',
  geometry: []
};

export const BoundaryUploadYupSchema = yup.object().shape({
  boundary_name: yup.string().max(3000, 'Cannot exceed 3000 characters'),
  geometry: yup.array().min(1, 'You must specify a project boundary').required('You must specify a project boundary')
});

const UploadBoundary: React.FC<React.PropsWithChildren<any>> = (props) => {
  const classes = useStyles();
  const formikProps = useFormikContext<IBoundaryUpload>();

  const boundaryUploadHandler = (): IUploadHandler => {
    return (file) => {
      if (file?.type.includes('zip') || file?.name.includes('.zip')) {
        handleShapefileUpload(file, 'geometry', formikProps);
      } else if (file?.type.includes('gpx') || file?.name.includes('.gpx')) {
        handleGPXUpload(file, 'geometry', formikProps);
      } else if (file?.type.includes('kml') || file?.name.includes('.kml')) {
        handleKMLUpload(file, 'geometry', formikProps);
      }

      return Promise.resolve();
    };
  };

  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12} mt={1}>
          <CustomTextField name="boundary_name" label="Boundary Name" other={{ multiline: false, rows: 1 }} />
        </Grid>
        <Grid item xs={12}>
          <Alert severity="info">If uploading a shapefile, it must be configured with a valid projection.</Alert>
          <FileUpload
            uploadHandler={boundaryUploadHandler()}
            dropZoneProps={{
              acceptedFileExtensions: AttachmentValidExtensions.SPATIAL
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="primary"
            className={classes.actionButton}
            data-testid="boundary_submit"
            onClick={() => {
              formikProps.handleSubmit();
            }}
          >
            Submit Boundary
          </Button>
        </Grid>
        {get(formikProps.errors, formikProps.values.boundary_name) && (
          <Box pt={2}>
            <Typography style={{ fontSize: '12px', color: '#f44336' }}>
              {get(formikProps.errors, formikProps.values.boundary_name)}
            </Typography>
          </Box>
        )}
      </Grid>
    </>
  );
};

export default UploadBoundary;
