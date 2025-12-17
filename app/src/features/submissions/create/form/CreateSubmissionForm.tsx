import { mdiAlertCircle } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, Box } from '@mui/material';
import { AxiosProgressEvent, CancelTokenSource } from 'axios';
import FileUpload from 'components/attachments/FileUpload';
import { IUploadHandler } from 'components/attachments/FileUploadItem';
import CustomTextField from 'components/fields/CustomTextField';
import { AttachmentValidExtensions } from 'constants/attachments';
import { useFormikContext } from 'formik';
import { ICreateSubmissionForm } from './CreateSubmissionForm.interface';

export const CreateSubmissionForm = () => {
  const { errors, setFieldError, setFieldValue } = useFormikContext<ICreateSubmissionForm>();

  const uploadHandler: IUploadHandler = async (
    file: File,
    _cancelToken: CancelTokenSource,
    _onProgress: (progressEvent: AxiosProgressEvent) => void
  ) => {
    if (!file) {
      return;
    }

    const isJson = file.name.toLowerCase().endsWith('.json');

    if (!isJson) {
      setFieldError('file', 'Only .json files are supported');
      return;
    }

    setFieldValue('file', file);

    return Promise.resolve();
  };

  return (
    <Box component="form" display="flex" flexDirection="column" gap={3}>
      {/* Name Field */}
      <CustomTextField name="name" label="Name" />

      {/* Description Field */}
      <CustomTextField
        name="description"
        label="Description"
        other={{
          multiline: true,
          rows: 4
        }}
      />

      {errors?.file && (
        <Alert severity="error" variant="filled" icon={<Icon path={mdiAlertCircle} size={1} />}>
          {errors.file.toString()}
        </Alert>
      )}

      {/* File Upload */}
      <FileUpload
        uploadHandler={uploadHandler}
        dropZoneProps={{
          acceptedFileExtensions: [AttachmentValidExtensions.JSON]
        }}
      />
    </Box>
  );
};
