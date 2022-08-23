import { mdiTrayArrowUp } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { makeStyles } from '@mui/styles';
import ComponentDialog from 'components/dialog/ComponentDialog';
import UploadBoundary, { BoundaryUploadInitialValues, IBoundaryUpload } from 'components/upload/UploadBoundary';
import { Formik, FormikProps } from 'formik';
import React, { useRef, useState } from 'react';

const useStyles = makeStyles(() => ({
  upload: {
    position: 'absolute',
    left: '20px',
    bottom: '20px',
    padding: '10px',
    zIndex: 400
  }
}));

export interface IUploadControlsProps {
  onBoundaryUpload: (boundary: IBoundaryUpload) => void;
}

const UploadControls: React.FC<React.PropsWithChildren<any>> = (props) => {
  const classes = useStyles();
  const formikRef = useRef<FormikProps<IBoundaryUpload>>(null);

  const [openUploadBoundary, setOpenUploadBoundary] = useState(false);

  const submitBoundary = (values: IBoundaryUpload) => {
    props.onBoundaryUpload(values);
    setOpenUploadBoundary(false);
  };

  return (
    <>
      <ComponentDialog
        open={openUploadBoundary}
        dialogTitle="Upload Boundary"
        onClose={() => setOpenUploadBoundary(false)}>
        <Formik
          key={'BoundaryUpload'}
          innerRef={formikRef}
          enableReinitialize={true}
          initialValues={BoundaryUploadInitialValues}
          // validationSchema={BoundaryUploadYupSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={submitBoundary}>
          <UploadBoundary />
        </Formik>
      </ComponentDialog>
      <Button
        className={classes.upload}
        color="primary"
        data-testid="boundary_file-upload"
        variant="contained"
        startIcon={<Icon path={mdiTrayArrowUp} size={1} />}
        onClick={() => setOpenUploadBoundary(true)}>
        Upload Boundary
      </Button>
    </>
  );
};

export default UploadControls;
