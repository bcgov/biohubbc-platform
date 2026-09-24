import { Box, Container, Paper, Stack } from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { PageHeader } from 'components/header/PageHeader';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import yup from 'utils/YupSchema';
import { uploadMultipartTar } from 'utils/submission-upload-utils';
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
    .required('You must submit a .tar file')
    .test('fileType', 'Only .tar files are supported', (value) => {
      return value instanceof File && value.name.toLowerCase().endsWith('.tar');
    })
});

export const CreateSubmissionPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bioHubApi = useApi();
  const dialogContext = useDialogContext();
  const navigate = useNavigate();

  const formikRef = useRef<FormikProps<ICreateSubmissionForm>>(null);

  /**
   * Upload a user-provided TAR archive as a multipart submission upload.
   */
  const handleSubmit = async (values: ICreateSubmissionForm) => {
    setIsSubmitting(true);

    const { file, ...submission } = values;

    try {
      // Request pre-signed upload URLs for multipart upload
      const uploadResponse = await bioHubApi.submissions.getSubmissionUploadUrls({
        ...submission,
        bytes: file.size
      });

      // Client follows backend-provided multipart instructions:
      // - `presignedUrls` already include server-assigned part numbers.
      // - each part includes an exact `partSizeBytes` instruction.
      // Upload TAR file in multiple parts
      const parts = await uploadMultipartTar(uploadResponse.presignedUrls, file);

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
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="new submission breadcrumb">
            <Link component={RouterLink} to="/admin/submissions" underline="hover" color="inherit">
              Submissions
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              New Submission
            </Typography>
          </Breadcrumbs>
        }
        label="New Submission"
        buttons={
          <Stack gap={1} flexDirection="row">
            <SecondaryButton disabled={isSubmitting} onClick={handleCancel}>
              Cancel
            </SecondaryButton>
            <PrimaryButton loading={isSubmitting} onClick={() => formikRef.current?.submitForm()}>
              Submit
            </PrimaryButton>
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
              <SecondaryButton disabled={isSubmitting} onClick={handleCancel}>
                Cancel
              </SecondaryButton>
              <PrimaryButton loading={isSubmitting} onClick={formikProps.submitForm}>
                Submit
              </PrimaryButton>
            </Stack>
          </Container>
        )}
      </Formik>
    </>
  );
};
