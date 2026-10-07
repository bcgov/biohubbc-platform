import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { RECONCILIATION_OUTCOMES } from 'constants/reconciliation';
import { useApi } from 'hooks/useApi';
import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { SubmissionUploadReviewValidationFeatureTypeContent } from './components/content/SubmissionUploadReviewValidationFeatureTypeContent';
import { submissionUploadQueryKeys } from './submission-upload-query-keys';

/**
 * Resolve a feature-type route and restrict it to a validation review of the owning upload.
 * @returns {JSX.Element} Feature-type properties content or its loading and invalid-route states.
 */
export const SubmissionUploadReviewValidationFeatureTypePage = () => {
  const api = useApi();
  const params = useParams();
  const submissionId = parseRouteId(params.submissionId);
  const submissionUploadId = params.submissionUploadId ?? '';
  const submissionUploadReviewId = params.submissionUploadReviewId ?? '';
  const featureType = params.featureType?.trim() ?? '';
  const outcome = RECONCILIATION_OUTCOMES.find(({ route }) => route === params.reconciliation);
  const valid =
    submissionId !== null &&
    Boolean(submissionUploadId && submissionUploadReviewId && featureType) &&
    (!params.reconciliation || Boolean(outcome));
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
        <SubmissionUploadReviewValidationFeatureTypeContent
          key={`${submissionId}/${submissionUploadId}/${featureType}`}
          submissionId={submissionId}
          review={review}
          featureType={featureType}
          outcomeRoute={outcome?.route}
        />
      )}
    </LoadingGuard>
  );
};
