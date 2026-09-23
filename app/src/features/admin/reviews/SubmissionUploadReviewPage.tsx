import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SubmissionUploadReviewSkeleton } from './components/loading/SubmissionUploadReviewSkeleton';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { SubmissionUploadReviewSecurityPage } from './security/SubmissionUploadReviewSecurityPage';
import { SubmissionUploadReviewValidationPage } from './SubmissionUploadReviewValidationPage';

/**
 * Resolves the review scope before rendering its workspace.
 *
 * @returns {JSX.Element} Rendered upload review workspace.
 */
export const SubmissionUploadReviewPage = () => {
  const api = useApi();
  const { submissionId, submissionUploadId, submissionUploadReviewId } = useParams();
  const reviewDataLoader = useDataLoader(
    (currentSubmissionId: number, currentSubmissionUploadId: string, currentSubmissionUploadReviewId: string) =>
      api.admin.getSubmissionUploadReview(
        currentSubmissionId,
        currentSubmissionUploadId,
        currentSubmissionUploadReviewId
      )
  );

  useEffect(() => {
    if (submissionId && submissionUploadId && submissionUploadReviewId) {
      reviewDataLoader.load(Number(submissionId), submissionUploadId, submissionUploadReviewId);
    }
  }, [reviewDataLoader, submissionId, submissionUploadId, submissionUploadReviewId]);

  if (!submissionId || !submissionUploadId || !submissionUploadReviewId) {
    return <Navigate to="/page-not-found" replace />;
  }

  const review = reviewDataLoader.data;

  return (
    <LoadingGuard
      isLoading={reviewDataLoader.isLoading && !reviewDataLoader.data}
      isLoadingFallback={<SubmissionUploadReviewSkeleton />}
      isLoadingFallbackDelay={300}
      hasNoData={reviewDataLoader.isReady && !reviewDataLoader.data}
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
