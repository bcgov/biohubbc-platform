import { Box, Button, Container, Paper, Stack } from '@mui/material';
import BaseHeader from 'components/layout/header/BaseHeader';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { estimateTarballSize, fileToUint8Array, uploadMultipartPaxStreamed } from 'utils/submission-upload-utils';
import { TarFileData } from 'utils/submission-upload-utils.interface';
import yup from 'utils/YupSchema';
import { v4 } from 'uuid';
import { CreateSubmissionForm } from './form/CreateSubmissionForm';
import { ICreateSubmissionForm } from './form/CreateSubmissionForm.interface';

const initialSubmissionValues: ICreateSubmissionForm = {
  name: '',
  description: '',
  comment: '',
  uid: v4(),
  file: null as unknown as File
};

export const SubmissionYupSchema = yup.object().shape({
  name: yup.string().required('Enter a name for the submission').max(100).min(1),
  description: yup.string().max(1000).min(1),
  comment: yup.string().max(1000).min(1),
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

  const handleSubmit = async (values: ICreateSubmissionForm) => {
    const { file, ...metadata } = values;
    setIsSubmitting(true);

    try {
      // Convert the JSON file to Uint8Array
      const fileBytes = await fileToUint8Array(file);

      // Prepare files for PAX archive
      const filesToPax: TarFileData[] = [
        {
          name: 'features.json',
          content: fileBytes
        }
      ];

      // Calculate total archive size
      const estimatedSize = estimateTarballSize(filesToPax);

      // Request pre-signed upload URLs for multipart upload
      const uploadResponse = await bioHubApi.quarantine.getSubmissionUploadUrls(estimatedSize);

      // Upload PAX archive using streaming approach
      const parts = await uploadMultipartPaxStreamed(
        uploadResponse.presignedUrls.map((p) => p.url),
        filesToPax,
        {
          chunkSize: uploadResponse.partSizeBytes
        }
      );

      // Extract part numbers and ETags for completion
      const parsedParts = parts.map((part) => ({
        partNumber: part.partNumber,
        etag: part.etag
      }));

      // Mark upload as complete
      await bioHubApi.quarantine.completeQuarantineUpload(
        uploadResponse.quarantineId,
        uploadResponse.uploadId,
        uploadResponse.key,
        parsedParts,
        metadata
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
            <Button loading={isSubmitting} variant="contained" onClick={formikRef.current?.submitForm}>
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
