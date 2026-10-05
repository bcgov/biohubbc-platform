import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonTable } from 'components/loading/SkeletonLoaders';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISubmissionUploadReviewDetail, ReconciliationFeatureScope } from 'interfaces/useAdminApi.interface';
import { useEffect } from 'react';
import { submissionUploadQueryKeys } from '../../submission-upload-query-keys';
import { SubmissionUploadReviewValidationReconciliationFeatures } from '../features/SubmissionUploadReviewValidationReconciliationFeatures';
import { SubmissionUploadReviewValidationReconciliationHeader } from '../header/SubmissionUploadReviewValidationReconciliationHeader';

interface SubmissionUploadReviewValidationReconciliationContentProps {
  scope: ReconciliationFeatureScope;
  review: ISubmissionUploadReviewDetail;
  label: string;
}

/**
 * Load outcome metadata and compose the header and Features section.
 * @param {SubmissionUploadReviewValidationReconciliationContentProps} props Validated outcome and review.
 * @returns {JSX.Element} Outcome layout with its feature-type counts.
 */
export const SubmissionUploadReviewValidationReconciliationContent = ({
  scope,
  review,
  label
}: SubmissionUploadReviewValidationReconciliationContentProps) => {
  const api = useApi();
  const { setSnackbar } = useDialogContext();
  const countsQuery = useQuery({
    queryKey: submissionUploadQueryKeys.reconciliationFeatures(scope),
    queryFn: ({ signal }) => api.admin.countReconciliationFeatures(scope, { signal })
  });

  useEffect(() => {
    if (countsQuery.error) {
      setSnackbar({ open: true, snackbarMessage: countsQuery.error.message });
    }
  }, [countsQuery.error, setSnackbar]);

  return (
    <>
      <SubmissionUploadReviewValidationReconciliationHeader
        submissionId={scope.submissionId}
        review={review}
        label={label}
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <PageSection id="reconciliation-features" label="Features">
          <LoadingGuard
            isLoading={countsQuery.isLoading}
            isLoadingFallback={<SkeletonTable />}
            hasNoData={!countsQuery.data?.feature_types.length}
            hasNoDataFallback={
              <Box p={2}>
                <Typography color="text.secondary">
                  {countsQuery.isError ? 'Unable to load features.' : 'No features found.'}
                </Typography>
              </Box>
            }>
            {countsQuery.data && (
              <SubmissionUploadReviewValidationReconciliationFeatures
                scope={scope}
                reviewId={review.submission_upload_review_id}
                featureTypes={countsQuery.data.feature_types}
              />
            )}
          </LoadingGuard>
        </PageSection>
      </Container>
    </>
  );
};
