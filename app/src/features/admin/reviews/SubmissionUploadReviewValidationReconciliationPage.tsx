import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { RECONCILIATION_OUTCOMES } from 'constants/reconciliation';
import { useApi } from 'hooks/useApi';
import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { SubmissionUploadReviewValidationReconciliationContent } from './components/content/SubmissionUploadReviewValidationReconciliationContent';
import { submissionUploadQueryKeys } from './submission-upload-query-keys';

/**
 * Validate the outcome route and restrict reconciliation browsing to validation reviews.
 * @returns {JSX.Element} Scoped reconciliation content, loading state, or invalid-route redirect.
 */
export const SubmissionUploadReviewValidationReconciliationPage = () => {
  const api = useApi();
  const params = useParams();
  const submissionId = parseRouteId(params.submissionId);
  const submissionUploadId = params.submissionUploadId ?? '';
  const submissionUploadReviewId = params.submissionUploadReviewId ?? '';
  const outcome = RECONCILIATION_OUTCOMES.find(({ route }) => route === params.reconciliation);
  const valid = submissionId !== null && Boolean(submissionUploadId && submissionUploadReviewId && outcome);
  const reviewQuery = useQuery({
    queryKey: submissionUploadQueryKeys.reviewDetail(submissionUploadReviewId),
    queryFn: valid
      ? ({ signal }) =>
          api.admin.getSubmissionUploadReview(submissionId, submissionUploadId, submissionUploadReviewId, { signal })
      : skipToken
  });
  const review = reviewQuery.data;

  if (
    !valid ||
    !outcome ||
    submissionId === null ||
    (review && (review.scope !== 'validation' || review.submission_upload_id !== submissionUploadId))
  ) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <LoadingGuard
      isLoading={reviewQuery.isLoading}
      isLoadingFallback={<SkeletonPage />}
      isLoadingFallbackDelay={300}
      hasNoData={!review}
      hasNoDataFallback={
        <Box p={2}>
          <Typography color="text.secondary">No review found</Typography>
        </Box>
      }>
      {review && (
        <SubmissionUploadReviewValidationReconciliationContent
          key={`${submissionId}/${submissionUploadId}/${submissionUploadReviewId}/${outcome.reconciliation}`}
          scope={{ submissionId, submissionUploadId, reconciliation: outcome.reconciliation }}
          review={review}
          label={outcome.label}
        />
      )}
    </LoadingGuard>
  );
};
