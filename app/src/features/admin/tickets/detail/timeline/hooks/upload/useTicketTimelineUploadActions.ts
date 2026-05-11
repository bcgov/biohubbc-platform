import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import {
  SubmissionUploadReviewScope,
  SubmissionUploadReviewTaskStatus,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';
import { useTicketTimelineConfirmationDialog } from '../useTicketTimelineConfirmationDialog';

type SubmissionUploadFinalDecision = 'approved' | 'denied';

/**
 * Submission upload review handlers for the ticket timeline.
 *
 * @returns Timeline upload action handlers.
 */
export const useTicketTimelineUploadActions = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const { openConfirmationDialog } = useTicketTimelineConfirmationDialog();

  const patchTicketUpload = (
    submissionUploadId: string,
    patch: (upload: TicketSubmissionUploadResponse) => TicketSubmissionUploadResponse
  ) => {
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    const submissionUploads = latestTicket.submission_uploads ?? [];

    ticketDataLoader.setData({
      ...latestTicket,
      submission_uploads: submissionUploads.map((upload) =>
        upload.submission_upload_id === submissionUploadId ? patch(upload) : upload
      )
    });
  };

  const patchTicketUploadReview = (
    upload: TicketSubmissionUploadResponse,
    review: TicketSubmissionUploadReviewResponse
  ) => {
    patchTicketUpload(upload.submission_upload_id, (currentUpload) => {
      const existingReview = currentUpload.reviews.find(
        (item) => item.submission_upload_review_id === review.submission_upload_review_id
      );

      return {
        ...currentUpload,
        reviews: existingReview
          ? currentUpload.reviews.map((item) =>
              item.submission_upload_review_id === review.submission_upload_review_id ? review : item
            )
          : [...currentUpload.reviews, review]
      };
    });
  };

  const handleSubmissionUploadReviewStatusUpdate = async (
    upload: TicketSubmissionUploadResponse,
    nextStatus: SubmissionUploadFinalDecision
  ) => {
    try {
      await api.tickets.updateSubmissionUploadReviewStatus(upload.submission_uuid, upload.submission_upload_id, {
        status: nextStatus
      });

      patchTicketUpload(upload.submission_upload_id, (currentUpload) => ({
        ...currentUpload,
        review_status: nextStatus,
        upload_status: nextStatus === 'approved' ? 'indexed' : currentUpload.upload_status
      }));
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    }
  };

  const handleSubmissionUploadReviewUpdate = async (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope,
    nextStatus: SubmissionUploadReviewTaskStatus
  ) => {
    try {
      const existingReview = upload.reviews.find((review) => review.scope === scope);
      let updatedReview: TicketSubmissionUploadReviewResponse;

      if (existingReview) {
        updatedReview = await api.tickets.updateSubmissionUploadReview(
          upload.submission_upload_id,
          existingReview.submission_upload_review_id,
          { status: nextStatus }
        );
      } else {
        const insertedReview = await api.tickets.insertSubmissionUploadReview(upload.submission_upload_id, { scope });

        updatedReview =
          nextStatus === insertedReview.status
            ? insertedReview
            : await api.tickets.updateSubmissionUploadReview(
                upload.submission_upload_id,
                insertedReview.submission_upload_review_id,
                { status: nextStatus }
              );
      }

      patchTicketUploadReview(upload, updatedReview);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    }
  };

  const handleConfirmSubmissionUploadReviewStatusUpdate = (
    upload: TicketSubmissionUploadResponse,
    nextStatus: SubmissionUploadFinalDecision
  ) => {
    const isApproval = nextStatus === 'approved';

    openConfirmationDialog({
      dialogTitle: isApproval ? 'Confirm Acceptance' : 'Confirm Rejection',
      dialogText: isApproval
        ? 'Are you sure you want to accept this submission upload?'
        : 'Are you sure you want to reject this submission upload?',
      yesButtonLabel: isApproval ? 'Accept' : 'Reject',
      onConfirm: async () => {
        await handleSubmissionUploadReviewStatusUpdate(upload, nextStatus);
      }
    });
  };

  return {
    handleSubmissionUploadReviewUpdate,
    handleConfirmSubmissionUploadReviewStatusUpdate
  };
};
