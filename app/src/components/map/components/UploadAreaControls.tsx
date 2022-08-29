import { mdiTrayArrowUp } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import EditDialog from 'components/dialog/EditDialog';
import UploadArea, {
  AreaUploadYupSchema,
  FormikAreaUploadInitialValues,
  IFormikAreaUpload
} from 'components/upload/UploadArea';
import { IDatasetSearchForm } from 'features/datasets/components/DatasetSearchForm';
import { useFormikContext } from 'formik';
import React, { useState } from 'react';

const UploadAreaControls: React.FC<React.PropsWithChildren<any>> = (props) => {
  const formikProps = useFormikContext<IDatasetSearchForm>();

  const [openUploadArea, setOpenUploadArea] = useState(false);

  const submitArea = (values: IFormikAreaUpload) => {
    formikProps.setFieldValue('area', [...formikProps.values.area, values]);
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
        color="primary"
        data-testid="Area_file-upload"
        variant="outlined"
        startIcon={<Icon path={mdiTrayArrowUp} size={1} />}
        onClick={() => setOpenUploadArea(true)}>
        Import
      </Button>
    </>
  );
};

export default UploadAreaControls;
