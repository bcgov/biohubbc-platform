import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { PageSection } from 'components/section/PageSection';
import { AdminSubmissionUploadErrors } from 'features/submissions/upload/components/content/AdminSubmissionUploadErrors';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SubmissionUploadMap } from './components/map/SubmissionUploadMap';
import { SubmissionUploadReconciliationTable } from './components/SubmissionUploadReconciliationTable';
import { SubmissionUploadReviewHeader } from './components/SubmissionUploadReviewHeader';
import { useUpdateSubmissionUploadReviewStatusMutation } from './hooks/useUpdateSubmissionUploadReviewStatusMutation';
import { submissionUploadQueryKeys } from './submission-upload-query-keys';

interface SubmissionUploadReviewValidationPageProps {
  review: ISubmissionUploadReviewDetail;
}

const FEATURES_TAB = 'features';
const ERRORS_TAB = 'errors';

/**
 * Validation review workspace for a single submission upload.
 *
 * Displays the review metadata with a Features tab, holding the reconciliation overview and a map of the upload's
 * active spatial features, and an Errors tab listing the upload's ingestion errors. Once shown, the Features tab stays
 * mounted behind the Errors tab so returning to it does not rebuild the map. `review` is the cached review detail, so
 * a status change written to that query re-renders the header.
 *
 * @param {SubmissionUploadReviewValidationPageProps} props - Validation review page properties.
 * @returns {JSX.Element} The submission upload validation review page.
 */
export const SubmissionUploadReviewValidationPage = (props: SubmissionUploadReviewValidationPageProps) => {
  const { review } = props;
  const navigate = useNavigate();
  const {
    submissionId = '',
    submissionUploadId = '',
    submissionUploadReviewId = ''
  } = useParams<{
    submissionId: string;
    submissionUploadId: string;
    submissionUploadReviewId: string;
  }>();
  const api = useApi();
  const dialogContext = useDialogContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === ERRORS_TAB ? ERRORS_TAB : FEATURES_TAB;
  const isFeaturesTab = activeTab === FEATURES_TAB;
  // The map frames its extent when it mounts, which needs a visible container: a page opened on the Errors tab mounts
  // the Features panel only once it is first shown.
  const [hasShownFeatures, setHasShownFeatures] = useState(isFeaturesTab);
  const scope = { submissionId: Number(submissionId), submissionUploadId };
  const hasUploadParams = Boolean(submissionId && submissionUploadId);
  const updateStatusMutation = useUpdateSubmissionUploadReviewStatusMutation({ ...scope, submissionUploadReviewId });

  const reconciliationQuery = useQuery({
    queryKey: submissionUploadQueryKeys.reconciliationCounts(scope),
    queryFn: hasUploadParams
      ? ({ signal }) =>
          api.admin.getSubmissionUploadReconciliationCounts(scope.submissionId, scope.submissionUploadId, { signal })
      : skipToken
  });

  const reconciliationCounts = reconciliationQuery.data;
  const isLoading = reconciliationQuery.isLoading;

  useEffect(() => {
    if (isFeaturesTab) {
      setHasShownFeatures(true);
    }
  }, [isFeaturesTab]);

  if (review?.scope && review.scope !== 'validation') {
    return <Navigate to="/page-not-found" replace />;
  }

  /**
   * Close the review status confirmation dialog.
   *
   * @returns {void}
   */
  const closeConfirmationDialog = () => {
    dialogContext.setYesNoDialog({ open: false });
  };

  /**
   * Toggle the current review between completed and in-progress status, reporting a failure.
   *
   * @returns {void}
   */
  const updateReviewStatus = () => {
    if (!submissionId || !submissionUploadId || !submissionUploadReviewId || !review) {
      return;
    }

    closeConfirmationDialog();
    updateStatusMutation.mutate(review.status === 'completed' ? 'in_progress' : 'completed', {
      onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
    });
  };

  /**
   * Open the confirmation dialog for the available review status action.
   *
   * @returns {void}
   */
  const handleStatusActionClick = () => {
    if (!review) {
      return;
    }

    const isCompleted = review.status === 'completed';
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: isCompleted ? 'Reopen Review' : 'Complete Review',
      dialogText: isCompleted
        ? 'Are you sure you want to reopen this review?'
        : 'Are you sure you want to complete this review?',
      onClose: closeConfirmationDialog,
      onNo: closeConfirmationDialog,
      onYes: updateReviewStatus
    });
  };

  return (
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={<SkeletonPage />}
      isLoadingFallbackDelay={300}
      hasNoData={!review || !reconciliationCounts}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No review found</Typography>
        </Box>
      }>
      {review && reconciliationCounts ? (
        <>
          <SubmissionUploadReviewHeader
            submissionId={Number(submissionId)}
            review={review}
            tabs={[
              {
                value: FEATURES_TAB,
                label: 'Features',
                id: 'review-features-tab',
                ariaControls: 'review-features-panel'
              },
              { value: ERRORS_TAB, label: 'Errors', id: 'review-errors-tab', ariaControls: 'review-errors-panel' }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', tab);
              setSearchParams(next);
            }}
            onStatusActionClick={handleStatusActionClick}
          />
          <Container maxWidth="xl" sx={{ py: 4 }}>
            {(isFeaturesTab || hasShownFeatures) && (
              <Box
                role="tabpanel"
                id="review-features-panel"
                aria-labelledby="review-features-tab"
                hidden={!isFeaturesTab}>
                <Stack spacing={4}>
                  <SubmissionUploadReconciliationTable
                    counts={reconciliationCounts}
                    onOutcomeClick={(route) => navigate(route)}
                  />
                  <PageSection id="review-map" label="Map">
                    <SubmissionUploadMap submissionId={Number(submissionId)} submissionUploadId={submissionUploadId} />
                  </PageSection>
                </Stack>
              </Box>
            )}
            {!isFeaturesTab && (
              <Box role="tabpanel" id="review-errors-panel" aria-labelledby="review-errors-tab">
                <AdminSubmissionUploadErrors scope={scope} />
              </Box>
            )}
          </Container>
        </>
      ) : null}
    </LoadingGuard>
  );
};
