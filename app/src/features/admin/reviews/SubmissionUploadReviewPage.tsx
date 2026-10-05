import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SubmissionUploadReviewSkeleton } from './components/loading/SubmissionUploadReviewSkeleton';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { Navigate, useParams } from 'react-router-dom';
import { SubmissionUploadReviewSecurityPage } from './security/SubmissionUploadReviewSecurityPage';
import { submissionUploadQueryKeys } from './submission-upload-query-keys';
import { SubmissionUploadReviewValidationPage } from './SubmissionUploadReviewValidationPage';

/**
 * Resolves the review scope before rendering its workspace.
 *
 * @returns {JSX.Element} Rendered upload review workspace.
 */
export const SubmissionUploadReviewPage = () => {
  const api = useApi();
  const { submissionId, submissionUploadId = '', submissionUploadReviewId = '' } = useParams();
  const hasReviewParams = Boolean(submissionId && submissionUploadId && submissionUploadReviewId);
  const scope = { submissionId: Number(submissionId), submissionUploadId, submissionUploadReviewId };
  const reviewQuery = useQuery({
    queryKey: submissionUploadQueryKeys.reviewDetail(scope.submissionUploadReviewId),
    queryFn: hasReviewParams
      ? ({ signal }) =>
          api.admin.getSubmissionUploadReview(
            scope.submissionId,
            scope.submissionUploadId,
            scope.submissionUploadReviewId,
            { signal }
          )
      : skipToken
  });

  if (!hasReviewParams) {
    return <Navigate to="/page-not-found" replace />;
  }

  const review = reviewQuery.data;

  return (
    <LoadingGuard
      isLoading={reviewQuery.isLoading}
      isLoadingFallback={<SubmissionUploadReviewSkeleton />}
      isLoadingFallbackDelay={300}
      hasNoData={!reviewQuery.isPending && !review}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No review found</Typography>
        </Box>
      }>
      {review ? (
        <ComponentSwitch
          switch={review.scope}
          components={{
            security: <SubmissionUploadReviewSecurityPage review={review} />,
            validation: <SubmissionUploadReviewValidationPage review={review} />
          }}
        />
      ) : null}
    </LoadingGuard>
  );
};
