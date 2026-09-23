import Container from '@mui/material/Container';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SubmissionUploadReviewHeader } from '../components/SubmissionUploadReviewHeader';
import { SecurityReviewFeaturesTab } from './components/content/features-tab/SecurityReviewFeaturesTab';

interface SubmissionUploadReviewSecurityPageProps {
  review: ISubmissionUploadReviewDetail;
}

/**
 * Renders the security-scoped upload review workspace.
 *
 * @param {SubmissionUploadReviewSecurityPageProps} props - Security review page properties.
 * @returns {JSX.Element} Rendered security review workspace.
 */
export const SubmissionUploadReviewSecurityPage = ({ review }: SubmissionUploadReviewSecurityPageProps) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { submissionId = '', submissionUploadId = '', submissionUploadReviewId = '' } = useParams();
  const [currentReview, setCurrentReview] = useState(review);
  const [refreshRevision, setRefreshRevision] = useState(0);

  /**
   * Completes or reopens the review and reports any failure.
   *
   * @returns {Promise<void>} Resolves after updating the review status or reporting a failure.
   */
  const updateReviewStatus = async () => {
    const nextStatus = currentReview.status === 'completed' ? 'in_progress' : 'completed';
    try {
      const updated = await api.admin.updateSubmissionUploadReview(
        Number(submissionId),
        submissionUploadId,
        submissionUploadReviewId,
        nextStatus
      );
      setCurrentReview(updated);
      dialogContext.setYesNoDialog({ open: false });
    } catch (error) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: (error as Error).message });
    }
  };

  /**
   * Opens confirmation to complete or reopen the review.
   *
   * @returns {void} Updates the shared confirmation dialog.
   */
  const openStatusDialog = () => {
    const isCompleted = currentReview.status === 'completed';
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: isCompleted ? 'Reopen Review' : 'Complete Review',
      dialogText: isCompleted
        ? 'Are you sure you want to reopen this review?'
        : 'Are you sure you want to complete this review?',
      onClose: () => dialogContext.setYesNoDialog({ open: false }),
      onNo: () => dialogContext.setYesNoDialog({ open: false }),
      onYes: updateReviewStatus
    });
  };

  const refreshSecurity = () => setRefreshRevision((revision) => revision + 1);

  return (
    <>
      <SubmissionUploadReviewHeader
        submissionId={Number(submissionId)}
        review={currentReview}
        onStatusActionClick={openStatusDialog}
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <SecurityReviewFeaturesTab
          submissionId={Number(submissionId)}
          submissionUploadId={submissionUploadId}
          submissionUploadReviewId={submissionUploadReviewId}
          refreshRevision={refreshRevision}
          onSecurityChanged={refreshSecurity}
        />
      </Container>
    </>
  );
};
