import { Box, Button, Container, Paper, Stack } from '@mui/material';
import BaseHeader from 'components/layout/header/BaseHeader';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTarData, fileToUint8Array, uploadMultipartTar } from 'utils/submission-upload-utils';
import yup from 'utils/YupSchema';
import { CreateSubmissionForm } from './form/CreateSubmissionForm';
import { ICreateSubmissionForm } from './form/CreateSubmissionForm.interface';

const initialSubmissionValues: ICreateSubmissionForm = {
  name: '',
  description: '',
  comment: '',
  file: null as unknown as File
};

export const SubmissionYupSchema = yup.object().shape({
  name: yup.string().required('Enter a name for the submission').max(100),
  description: yup.string().max(500).required('Description is required'),
  comment: yup.string().max(500).required('Comment is required'),
  file: yup
    .mixed<File>()
    .required('You must submit a .json file')
    .test('fileType', 'Only .json files are supported', (value) => {
      return value instanceof File && value.name.toLowerCase().endsWith('.json');
    })
});

export const CreateSubmissionPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bioHubApi = useApi();
  const dialogContext = useDialogContext();
  const navigate = useNavigate();

  const formikRef = useRef<FormikProps<ICreateSubmissionForm>>(null);

  /**
   * NOTE: The logic in creating the .tar file should be improved, where possible
   */
  const handleSubmit = async (values: ICreateSubmissionForm) => {
    setIsSubmitting(true);

    const { file, ...submission } = values;

    try {
      // Convert the JSON file to Uint8Array
      const fileBytes = await fileToUint8Array(file);

      // Prepare files for TAR - just the JSON file
      const filesToTar = [
        {
          name: 'features.json',
          content: fileBytes
        }
      ];

      // Create TAR data
      const tarData = createTarData(filesToTar);

      // Request pre-signed upload URLs for multipart upload
      const uploadResponse = await bioHubApi.submissions.getSubmissionUploadUrls({
        ...submission,
        bytes: tarData.length
      });
      const uploadUrls = uploadResponse.presignedUrls.map((presigned) => presigned.url);

      // Upload TAR file in multiple parts
      const parts = await uploadMultipartTar(uploadUrls, tarData);

      // Mark upload as complete
      await bioHubApi.submissions.completeSubmissionUpload(
        uploadResponse.uploadId,
        uploadResponse.s3UploadId,
        uploadResponse.key,
        parts
      );

      dialogContext.setSnackbar({
        snackbarMessage: `Successfully submitted "${values.name}"`,
        open: true
      });
    } catch (error) {
      console.error('Submission error:', error);
      dialogContext.setSnackbar({
        snackbarMessage: (error as APIError).message,
        open: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/submissions');
  };

  return (
    <>
      <BaseHeader
        title="New Submission"
        buttonJSX={
          <Stack gap={1} flexDirection="row">
            <Button variant="outlined" disabled={isSubmitting} onClick={handleCancel}>
              Cancel
            </Button>
            <Button loading={isSubmitting} variant="contained" onClick={() => formikRef.current?.submitForm()}>
              Submit
            </Button>
          </Stack>
        }
      />
      <Formik
        innerRef={formikRef}
        initialValues={initialSubmissionValues}
        validationSchema={SubmissionYupSchema}
        validateOnBlur
        validateOnChange={false}
        enableReinitialize
        onSubmit={handleSubmit}>
        {(formikProps) => (
          <Container component={Paper} maxWidth="xl" sx={{ bgcolor: '#fff', py: 2, mt: 3 }}>
            <Box my={3}>
              <CreateSubmissionForm />
            </Box>
            <Stack gap={1} flexDirection="row" flex="1 1 auto" justifyContent="flex-end">
              <Button variant="outlined" disabled={isSubmitting} onClick={handleCancel}>
                Cancel
              </Button>
              <Button loading={isSubmitting} variant="contained" onClick={formikProps.submitForm}>
                Submit
              </Button>
            </Stack>
          </Container>
        )}
      </Formik>
    </>
  );
};
