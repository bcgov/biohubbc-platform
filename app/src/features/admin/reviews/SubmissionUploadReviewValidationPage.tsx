import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { SubmissionFeatureTable } from 'features/submissions/components/SubmissionFeatureTable';
import { SubmissionUploadReconciliationTable } from './components/SubmissionUploadReconciliationTable';
import { SubmissionUploadReviewHeader, SubmissionUploadReviewTab } from './components/SubmissionUploadReviewHeader';

/**
 * Validation review workspace for a single submission upload.
 *
 * Displays the review metadata, reconciliation overview, and a server-paginated
 * table containing the active features belonging to the reviewed submission upload.
 *
 * @returns {JSX.Element} The submission upload validation review page.
 */
export const SubmissionUploadReviewValidationPage = () => {
  const navigate = useNavigate();
  const { submissionId, submissionUploadId, reviewId } = useParams<{
    submissionId: string;
    submissionUploadId: string;
    reviewId: string;
  }>();
  const api = useApi();
  const dialogContext = useDialogContext();
  const [activeTab, setActiveTab] = useState<SubmissionUploadReviewTab>('features');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const reviewDataLoader = useDataLoader((currentSubmissionId: number, uploadId: string, uploadReviewId: string) =>
    api.admin.getSubmissionUploadReview(currentSubmissionId, uploadId, uploadReviewId)
  );
  const reconciliationDataLoader = useDataLoader((currentSubmissionId: number, uploadId: string) =>
    api.admin.getSubmissionUploadReconciliationCounts(currentSubmissionId, uploadId)
  );
  const featureGrid = useServerPaginatedDataGrid({
    fetcher: (_search, pagination) =>
      api.admin.getSubmissionUploadFeatures(Number(submissionId), submissionUploadId!, pagination),
    extractData: (response) =>
      response.features.map((feature) => ({
        submission_feature_id: feature.submission_feature_id,
        feature_type_name: feature.feature_type_name
      })),
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'submission_feature_id', sort: 'asc' }
  });

  useEffect(() => {
    if (submissionId && submissionUploadId && reviewId) {
      reviewDataLoader.load(Number(submissionId), submissionUploadId, reviewId);
      reconciliationDataLoader.load(Number(submissionId), submissionUploadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionUploadId, reviewId]);

  const review = reviewDataLoader.data;
  const reconciliationCounts = reconciliationDataLoader.data;
  const isLoading =
    (reviewDataLoader.isLoading && !review) || (reconciliationDataLoader.isLoading && !reconciliationCounts);

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
   * Toggle the current review between completed and in-progress status.
   *
   * @returns {Promise<void>} Resolves after the review status update finishes.
   */
  const updateReviewStatus = async () => {
    if (!submissionId || !submissionUploadId || !reviewId || !review) {
      return;
    }

    closeConfirmationDialog();
    const status = review.status === 'completed' ? 'in_progress' : 'completed';

    try {
      setIsSavingStatus(true);
      const updatedReview = await api.admin.updateSubmissionUploadReview(
        Number(submissionId),
        submissionUploadId,
        reviewId,
        status
      );
      reviewDataLoader.setData(updatedReview);
    } catch (error) {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (error as Error).message
      });
    } finally {
      setIsSavingStatus(false);
    }
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
            isSavingStatus={isSavingStatus}
            onStatusActionClick={handleStatusActionClick}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <Container maxWidth="xl" sx={{ py: 4 }}>
            <ComponentSwitch<SubmissionUploadReviewTab>
              switch={activeTab}
              components={{
                features: (
                  <Stack spacing={4}>
                    <SubmissionUploadReconciliationTable counts={reconciliationCounts} />
                    <SubmissionFeatureTable
                      rows={featureGrid.rows}
                      rowCount={featureGrid.rowCount}
                      isLoading={featureGrid.isLoading}
                      onRowClick={(params) => handleFeatureRowClick(params.row.submission_feature_id)}
                      paginationModel={featureGrid.paginationModel}
                      onPaginationModelChange={featureGrid.handlePaginationChange}
                      sortModel={featureGrid.sortModel}
                      onSortModelChange={featureGrid.handleSortChange}
                    />
                  </Stack>
                )
              }}
            />
          </Container>
        </>
      ) : null}
    </LoadingGuard>
  );
};
