import Container from '@mui/material/Container';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { useEffect } from 'react';
import { submissionUploadQueryKeys } from '../../submission-upload-query-keys';
import { SubmissionUploadReviewValidationFeatureTypeHeader } from '../header/SubmissionUploadReviewValidationFeatureTypeHeader';
import { SubmissionUploadReviewFeatureTypePropertiesTable } from '../table/SubmissionUploadReviewFeatureTypePropertiesTable';

interface SubmissionUploadReviewValidationFeatureTypeContentProps {
  submissionId: number;
  review: ISubmissionUploadReviewDetail;
  featureType: string;
  outcomeRoute?: string;
}

/**
 * Load unique definitions for a feature type across the upload and compose the page.
 * @param {SubmissionUploadReviewValidationFeatureTypeContentProps} props Validated review and feature-type route.
 * @returns {JSX.Element} Feature-type header and Properties section.
 */
export const SubmissionUploadReviewValidationFeatureTypeContent = ({
  submissionId,
  review,
  featureType,
  outcomeRoute
}: SubmissionUploadReviewValidationFeatureTypeContentProps) => {
  const api = useApi();
  const { setSnackbar } = useDialogContext();
  const submissionUploadId = review.submission_upload_id;
  const propertiesQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureTypeProperties({ submissionId, submissionUploadId }, featureType),
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadFeatureTypeProperties(submissionId, submissionUploadId, featureType, { signal })
  });

  useEffect(() => {
    if (propertiesQuery.error) {
      setSnackbar({ open: true, snackbarMessage: propertiesQuery.error.message });
    }
  }, [propertiesQuery.error, setSnackbar]);

  return (
    <>
      <SubmissionUploadReviewValidationFeatureTypeHeader
        submissionId={submissionId}
        review={review}
        featureType={featureType}
        outcomeRoute={outcomeRoute}
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <SubmissionUploadReviewFeatureTypePropertiesTable
          properties={propertiesQuery.data?.properties ?? []}
          isLoading={propertiesQuery.isLoading}
          hasError={propertiesQuery.isError}
        />
      </Container>
    </>
  );
};
