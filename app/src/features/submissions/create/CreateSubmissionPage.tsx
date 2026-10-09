import { Box, Container, Paper, Stack } from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from 'components/header/PageHeader';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import yup from 'utils/YupSchema';
import { uploadMultipartTar } from 'utils/submission-upload-utils';
import { CreateSubmissionForm } from './form/CreateSubmissionForm';
import { ICreateSubmissionForm } from './form/CreateSubmissionForm.interface';

const initialSubmissionValues: ICreateSubmissionForm = {
  clientId: '',
  name: '',
  description: '',
  comment: '',
  file: null as unknown as File
};

export const SubmissionYupSchema = yup.object().shape({
  clientId: yup.string().trim().max(100),
  name: yup.string().required('Enter a name for the submission').max(100),
  description: yup.string().max(500).required('Description is required'),
  comment: yup.string().max(500).required('Comment is required'),
  file: yup
    .mixed<File>()
    .required('You must submit a .tar or .tar.gz file')
    .test('fileType', 'Only .tar and .tar.gz files are supported', (value) => {
      return value instanceof File && /\.tar(?:\.gz)?$/i.test(value.name);
    })
});

/**
 * Create a submission for the selected contributor or token default and upload its archive.
 *
 * @returns The submission creation page.
 */
export const CreateSubmissionPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bioHubApi = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();
  const navigate = useNavigate();

  const formikRef = useRef<FormikProps<ICreateSubmissionForm>>(null);

  /**
   * Upload a user-provided TAR archive as a multipart submission upload.
   *
   * @param values Contributor selection, submission details, and archive file.
   * @returns Resolves after upload completion or displaying the request error.
   */
  const handleSubmit = async (values: ICreateSubmissionForm) => {
    setIsSubmitting(true);

    const { file, clientId, ...submission } = values;
    const selectedClientId = clientId.trim();

    try {
      // Request pre-signed upload URLs for multipart upload
      const uploadResponse = await bioHubApi.submissions.getSubmissionUploadUrls({
        ...submission,
        ...(selectedClientId ? { client_id: selectedClientId } : {}),
        bytes: file.size,
        archiveFormat: file.name.toLowerCase().endsWith('.tar.gz') ? 'tar.gz' : 'tar'
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
      void refreshChangedQueries(queryClient, changedQueryKeys.submissionCreated());

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
