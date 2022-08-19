import { Alert, Button, Grid } from '@mui/material';
import { makeStyles } from '@mui/styles';
import FileUpload from 'components/attachments/FileUpload';
import CustomTextField from 'components/fields/CustomTextField';
import { AttachmentValidExtensions } from 'constants/attachments';
import { Formik, FormikProps } from 'formik';
import { Feature } from 'geojson';
import React, { useRef } from 'react';
import yup from 'utils/YupSchema';
// import { handleGPXUpload, handleKMLUpload, handleShapefileUpload } from 'utils/mapUploadUtils';

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
  const formikRef = useRef<FormikProps<IBoundaryUpload>>(null);

  const submitBoundary = () => {
    console.log('poop');
  };

  const boundaryUploadHandler = (): any => {
    console.log('aaaaaaaaaaaaaaaaaaaa');
    // return (file) => {
    //   if (file?.type.includes('zip') || file?.name.includes('.zip')) {
    //     handleShapefileUpload(file, name, formikProps);
    //   } else if (file?.type.includes('gpx') || file?.name.includes('.gpx')) {
    //     handleGPXUpload(file, name, formikProps);
    //   } else if (file?.type.includes('kml') || file?.name.includes('.kml')) {
    //     handleKMLUpload(file, name, formikProps);
    //   }

    //   return Promise.resolve();
    // };
  };

  return (
    <>
      <Formik
        key={'BoundaryUpload'}
        innerRef={formikRef}
        enableReinitialize={true}
        initialValues={BoundaryUploadInitialValues}
        validationSchema={BoundaryUploadYupSchema}
        validateOnBlur={true}
        validateOnChange={false}
        onSubmit={submitBoundary}
      >
        <form>
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
                type="submit"
                variant="contained"
                color="primary"
                className={classes.actionButton}
                data-testid="boundary_submit"
              >
                Submit Boundary
              </Button>
            </Grid>
          </Grid>
        </form>
      </Formik>
    </>
  );
};

export default UploadBoundary;
