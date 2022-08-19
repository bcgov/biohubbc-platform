import { mdiTrayArrowUp } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { makeStyles } from '@mui/styles';
import ComponentDialog from 'components/dialog/ComponentDialog';
import UploadBoundary from 'components/upload/UploadBoundary';
import React, { useState } from 'react';
// import { handleGPXUpload, handleKMLUpload, handleShapefileUpload } from 'utils/mapUploadUtils';

const useStyles = makeStyles(() => ({
  upload: {
    position: 'absolute',
    left: '20px',
    bottom: '20px',
    padding: '10px',
    zIndex: 400
  }
}));

const UploadControls: React.FC<React.PropsWithChildren<any>> = (props) => {
  const classes = useStyles();

  const [openUploadBoundary, setOpenUploadBoundary] = useState(false);

  return (
    <>
      <ComponentDialog
        open={openUploadBoundary}
        dialogTitle="Upload Boundary"
        onClose={() => setOpenUploadBoundary(false)}
      >
        <UploadBoundary />
      </ComponentDialog>
      <Button
        className={classes.upload}
        color="primary"
        data-testid="boundary_file-upload"
        variant="contained"
        startIcon={<Icon path={mdiTrayArrowUp} size={1} />}
        onClick={() => setOpenUploadBoundary(true)}
      >
        Upload Boundary
      </Button>
    </>
  );
};

export default UploadControls;
