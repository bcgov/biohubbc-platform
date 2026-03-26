import { mdiAlertCircle } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, Box } from '@mui/material';
import { AxiosProgressEvent, CancelTokenSource } from 'axios';
import FileUpload from 'components/attachments/FileUpload';
import { IUploadHandler } from 'components/attachments/FileUploadItem';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { AttachmentValidExtensions } from 'constants/attachments';
import { useFormikContext } from 'formik';
import { useConfigContext } from 'hooks/useContext';
import { ICreateSubmissionForm } from './CreateSubmissionForm.interface';

export const CreateSubmissionForm = () => {
  const { errors, setFieldError, setFieldValue } = useFormikContext<ICreateSubmissionForm>();
  const config = useConfigContext();

  const uploadHandler: IUploadHandler = async (
    file: File,
    _cancelToken: CancelTokenSource,
    _onProgress: (progressEvent: AxiosProgressEvent) => void
  ) => {
    if (!file) {
      return;
    }

    const isTar = file.name.toLowerCase().endsWith('.tar');

    if (!isTar) {
      setFieldError('file', 'Only .tar files are supported');
      return;
    }

    setFieldValue('file', file);

    return Promise.resolve();
  };

  return (
    <Box component="form" display="flex" flexDirection="column" gap={3}>
      {/* Name Field */}
      <CustomTextFieldFormik name="name" label="Name" />

      {/* Description Field */}
      <CustomTextFieldFormik name="description" label="Description" multiline rows={4} />

      {/* Comment Field */}
      <CustomTextFieldFormik name="comment" label="Comment" multiline rows={4} />

      {errors?.file && (
        <Alert severity="error" variant="filled" icon={<Icon path={mdiAlertCircle} size={1} />}>
          {errors.file.toString()}
        </Alert>
      )}

      {/* File Upload */}
      <FileUpload
        uploadHandler={uploadHandler}
        dropZoneProps={{
          maxFileSize: config.MAX_UPLOAD_TARBALL_SIZE,
          acceptedFileExtensions: [AttachmentValidExtensions.TAR]
        }}
      />
    </Box>
  );
};
