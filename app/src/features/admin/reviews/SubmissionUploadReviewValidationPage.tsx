import { keepPreviousDataWithin } from 'utils/query-client';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { SubmissionFeatureTable } from 'features/submissions/components/SubmissionFeatureTable';
import { SubmissionUploadMap } from './components/map/SubmissionUploadMap';
import { SubmissionUploadReconciliationTable } from './components/SubmissionUploadReconciliationTable';
import { SubmissionUploadReviewHeader } from './components/SubmissionUploadReviewHeader';
import { useUpdateSubmissionUploadReviewStatusMutation } from './hooks/useUpdateSubmissionUploadReviewStatusMutation';
import { submissionUploadQueryKeys } from './submission-upload-query-keys';

interface SubmissionUploadReviewValidationPageProps {
  review: ISubmissionUploadReviewDetail;
}

/**
 * Validation review workspace for a single submission upload.
 *
 * Displays the review metadata, reconciliation overview, a map of the upload's active
 * spatial features, and a server-paginated table containing the features belonging to
 * the reviewed submission upload. `review` is the cached review detail, so a status change
 * written to that query re-renders the header.
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

  const featureGrid = useServerPaginatedGridState({ defaultSort: { field: 'submission_feature_id', sort: 'asc' } });
  const featuresQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureList(scope, featureGrid.apiPagination),
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadFeatures(scope.submissionId, scope.submissionUploadId, featureGrid.apiPagination, {
        signal
      }),
    placeholderData: keepPreviousDataWithin(submissionUploadQueryKeys.upload(scope))
  });
  const featureRows = useMemo(
    () =>
      featuresQuery.data?.features.map((feature) => ({
        submission_feature_id: feature.submission_feature_id,
        feature_type_name: feature.feature_type_name
      })) ?? [],
    [featuresQuery.data]
  );

  const reconciliationCounts = reconciliationQuery.data;
  const isLoading = reconciliationQuery.isLoading;

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

  /**
   * Navigate to a feature detail page nested under the current review.
   *
   * @param {number} submissionFeatureId ID of the feature to open.
   * @returns {void}
   */
  const handleFeatureRowClick = (submissionFeatureId: number) => {
    navigate(`feature/${submissionFeatureId}`);
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
            onStatusActionClick={handleStatusActionClick}
          />
          <Container maxWidth="xl" sx={{ py: 4 }}>
            <Stack spacing={4}>
              <SubmissionUploadReconciliationTable counts={reconciliationCounts} />
              <PageSection id="review-map" label="Map">
                <SubmissionUploadMap submissionId={Number(submissionId)} submissionUploadId={submissionUploadId} />
              </PageSection>
              <SubmissionFeatureTable
                rows={featureRows}
                rowCount={featuresQuery.data?.pagination.total ?? 0}
                isLoading={featuresQuery.isFetching && !featuresQuery.data}
                onRowClick={(params) => handleFeatureRowClick(params.row.submission_feature_id)}
                paginationModel={featureGrid.paginationModel}
                onPaginationModelChange={featureGrid.handlePaginationChange}
                sortModel={featureGrid.sortModel}
                onSortModelChange={featureGrid.handleSortChange}
              />
            </Stack>
          </Container>
        </>
      ) : null}
    </LoadingGuard>
  );
};
