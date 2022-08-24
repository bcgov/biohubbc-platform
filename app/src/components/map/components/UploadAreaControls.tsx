import { mdiTrayArrowUp } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { makeStyles } from '@mui/styles';
import EditDialog from 'components/dialog/EditDialog';
import UploadArea, {
  AreaUploadYupSchema,
  FormikAreaUploadInitialValues,
  IFormikAreaUpload
} from 'components/upload/UploadArea';
import React, { useState } from 'react';

const useStyles = makeStyles(() => ({
  upload: {
    position: 'absolute',
    left: '20px',
    bottom: '60px',
    padding: '10px',
    zIndex: 400
  }
}));

export interface IUploadAreaControlsProps {
  onAreaUpload: (area: IFormikAreaUpload) => void;
}

const UploadAreaControls: React.FC<React.PropsWithChildren<any>> = (props) => {
  const classes = useStyles();
  const [openUploadArea, setOpenUploadArea] = useState(false);

  const submitArea = (values: IFormikAreaUpload) => {
    props.onAreaUpload(values);
    setOpenUploadArea(false);
  };

  return (
    <>
      <EditDialog
        dialogTitle={'Import Area of Interest'}
        open={openUploadArea}
        dialogSaveButtonLabel={'Import'}
        component={{
          element: <UploadArea />,
          initialValues: FormikAreaUploadInitialValues,
          validationSchema: AreaUploadYupSchema
        }}
        onCancel={() => setOpenUploadArea(false)}
        onSave={submitArea}
      />
      <Button
        className={classes.upload}
        color="primary"
        data-testid="Area_file-upload"
        variant="contained"
        startIcon={<Icon path={mdiTrayArrowUp} size={1} />}
        onClick={() => setOpenUploadArea(true)}>
        Import
      </Button>
    </>
  );
};

export default UploadAreaControls;
