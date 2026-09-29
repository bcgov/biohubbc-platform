import Container from '@mui/material/Container';
import { useDialogContext } from 'hooks/useContext';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { useParams } from 'react-router-dom';
import { SubmissionUploadReviewHeader } from '../components/SubmissionUploadReviewHeader';
import { SecurityReviewFeaturesTab } from './components/content/features-tab/SecurityReviewFeaturesTab';
import { useUpdateSubmissionUploadReviewStatusMutation } from '../hooks/useUpdateSubmissionUploadReviewStatusMutation';

interface SubmissionUploadReviewSecurityPageProps {
  review: ISubmissionUploadReviewDetail;
}

/**
 * Renders the security-scoped upload review workspace.
 *
 * `review` is the cached review detail, so a status change written to that query re-renders the header.
 *
 * @param {SubmissionUploadReviewSecurityPageProps} props - Security review page properties.
 * @returns {JSX.Element} Rendered security review workspace.
 */
export const SubmissionUploadReviewSecurityPage = ({ review }: SubmissionUploadReviewSecurityPageProps) => {
  const dialogContext = useDialogContext();
  const { submissionId = '', submissionUploadId = '', submissionUploadReviewId = '' } = useParams();
  const updateStatusMutation = useUpdateSubmissionUploadReviewStatusMutation({
    submissionId: Number(submissionId),
    submissionUploadId,
    submissionUploadReviewId
  });

  /**
   * Completes or reopens the review and reports any failure.
   *
   * @returns {void} Starts the update; the dialog closes on success and a snackbar reports a failure.
   */
  const updateReviewStatus = () => {
    updateStatusMutation.mutate(review.status === 'completed' ? 'in_progress' : 'completed', {
      onSuccess: () => dialogContext.setYesNoDialog({ open: false }),
      onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
    });
  };

  /**
   * Opens confirmation to complete or reopen the review.
   *
   * @returns {void} Updates the shared confirmation dialog.
   */
  const openStatusDialog = () => {
    const isCompleted = review.status === 'completed';
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

  return (
    <>
      <SubmissionUploadReviewHeader
        submissionId={Number(submissionId)}
        review={review}
        onStatusActionClick={openStatusDialog}
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <SecurityReviewFeaturesTab
          submissionId={Number(submissionId)}
          submissionUploadId={submissionUploadId}
          submissionUploadReviewId={submissionUploadReviewId}
        />
      </Container>
    </>
  );
};
