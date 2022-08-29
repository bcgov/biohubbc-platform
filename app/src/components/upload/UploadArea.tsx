import { Alert, Box, Grid, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';
import FileUpload from 'components/attachments/FileUpload';
import { IUploadHandler } from 'components/attachments/FileUploadItem';
import CustomTextField from 'components/fields/CustomTextField';
import { AttachmentValidExtensions } from 'constants/attachments';
import { useFormikContext } from 'formik';
import { Feature, Polygon } from 'geojson';
import React from 'react';
import { handleKMLUpload, handleShapefileUpload } from 'utils/mapUtils';
import yup from 'utils/YupSchema';

const useStyles = makeStyles((theme) => ({
  pointType: {
    lineHeight: 'unset'
  },
  date: {
    margin: 0,
    lineHeight: 'unset'
  }
}));

export interface IFormikAreaUpload {
  name: string;
  features: Feature<Polygon>[];
}

export const FormikAreaUploadInitialValues: IFormikAreaUpload = {
  name: '',
  features: []
};

export const AreaUploadYupSchema = yup.object().shape({
  name: yup.string().required('Area name required').max(100, 'Cannot exceed 100 characters'),
  features: yup.array().min(1, 'You must specify a project Area').required('You must specify a project Area')
});

export const AreaToolTip: React.FC<React.PropsWithChildren<{ name: string }>> = (props) => {
  const classes = useStyles();
  return (
    <Box mb={1}>
      <Typography variant="overline" className={classes.pointType}>
        Area:
      </Typography>
      {props.name && (
        <Typography className={classes.date} component="h6" variant="subtitle1">
          {props.name}
        </Typography>
      )}
    </Box>
  );
};

const UploadArea: React.FC<React.PropsWithChildren<any>> = (props) => {
  const formikProps = useFormikContext<IFormikAreaUpload>();

  const AreaUploadHandler = (): IUploadHandler => {
    return (file) => {
      if (file?.type.includes('zip') || file?.name.includes('.zip')) {
        handleShapefileUpload(file, 'features', formikProps);
      } else if (file?.type.includes('kml') || file?.name.includes('.kml')) {
        handleKMLUpload(file, 'features', formikProps);
      }

      return Promise.resolve();
    };
  };

  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12} mt={1}>
          <CustomTextField
            name="name"
            label="Area Name"
            other={{ multiline: false, rows: 1, error: !!formikProps.errors.name }}
          />
        </Grid>
        <Grid item xs={12}>
          {!formikProps.errors.features && (
            <Alert severity="info">If uploading a shapefile, it must be configured with a valid projection.</Alert>
          )}
          {formikProps.errors.features && <Alert severity="error">{formikProps.errors.features?.toString()}</Alert>}
          <FileUpload
            uploadHandler={AreaUploadHandler()}
            dropZoneProps={{
              acceptedFileExtensions: AttachmentValidExtensions.SPATIAL
            }}
            replace={true}
          />
        </Grid>
      </Grid>
    </>
  );
};

export default UploadArea;
