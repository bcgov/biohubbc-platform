import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import {
  ICreateSubmissionUploadReviewRequest,
  IUpdateSubmissionUploadReviewStatusRequest,
  SubmissionUploadReviewScope,
  TicketSubmissionUploadResponse
} from 'interfaces/useTicketsApi.interface';
import { useNavigate } from 'react-router-dom';
import { useTicketTimelineConfirmationDialog } from '../useTicketTimelineConfirmationDialog';

type SubmissionUploadReviewStatusUpdate = IUpdateSubmissionUploadReviewStatusRequest['status'];

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
  const navigate = useNavigate();

  const updateCachedSubmissionUpload = (
    submissionUploadId: string,
    updateUpload: (upload: TicketSubmissionUploadResponse) => TicketSubmissionUploadResponse
  ): void => {
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      submission_uploads: latestTicket.submission_uploads.map((upload) =>
        upload.submission_upload_id === submissionUploadId ? updateUpload(upload) : upload
      )
    });
  };

  /**
   * Replaces the cached final review status for one upload after the backend accepts or denies it.
   * This is only used for the upload-level decision row and intentionally leaves scoped review tasks unchanged.
   *
   * @param {string} submissionUploadId Submission upload being updated in the ticket cache.
   * @param {TicketSubmissionUploadResponse['review_status']} reviewStatus Backend-confirmed upload review status.
   * @returns {void}
   */
  const setCachedUploadReviewStatus = (
    submissionUploadId: string,
    reviewStatus: TicketSubmissionUploadResponse['review_status']
  ): void => {
    updateCachedSubmissionUpload(submissionUploadId, (upload) => ({ ...upload, review_status: reviewStatus }));
  };

  /**
   * Shows the API error from a failed upload action in the shared ticket snackbar.
   * All upload handlers use the same failure path so the UI reports backend validation and permission errors consistently.
   *
   * @param {unknown} error Error thrown by the tickets API client.
   * @returns {void}
   */
  const showUploadActionError = (error: unknown): void => {
    const apiError = error as APIError;
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: apiError.message
    });
  };

  /**
   * Persists an upload-level acceptance or denial and updates the cached upload with the backend response.
   * Use this only from the confirmation dialog callback, after the reviewer has confirmed the final decision.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload receiving the final review decision.
   * @param {SubmissionUploadReviewStatusUpdate} nextStatus Review status to persist.
   * @returns {Promise<void>} Resolves after the backend response has been reflected in local ticket state.
   */
  const handleSubmissionUploadReviewStatusUpdate = async (
    upload: TicketSubmissionUploadResponse,
    nextStatus: SubmissionUploadReviewStatusUpdate
  ): Promise<void> => {
    try {
      const updatedReviewStatus = await api.tickets.updateSubmissionUploadReviewStatus(
        upload.submission_id,
        upload.submission_upload_id,
        {
          status: nextStatus
        }
      );

      setCachedUploadReviewStatus(upload.submission_upload_id, updatedReviewStatus.status);
    } catch (error) {
      showUploadActionError(error);
    }
  };

  /**
   * Creates an in-progress scoped review and opens its review workflow.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload that owns the new review.
   * @param {SubmissionUploadReviewScope} scope Scope selected by the administrator.
   * @returns {Promise<void>} Resolves after navigation or after a failed request is reported.
   */
  const handleCreateSubmissionUploadReview = async (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope,
    review: Pick<ICreateSubmissionUploadReviewRequest, 'name' | 'description'>
  ): Promise<void> => {
    try {
      const insertedReview = await api.tickets.insertSubmissionUploadReview(
        upload.submission_id,
        upload.submission_upload_id,
        {
          ...review,
          scope,
          status: 'in_progress'
        }
      );

      navigate(
        `/admin/submission/${upload.submission_id}/upload/${upload.submission_upload_id}/review/${scope}/${insertedReview.submission_upload_review_id}`
      );
    } catch (error) {
      showUploadActionError(error);
    }
  };

  /**
   * Opens an existing scoped review workflow.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload that owns the existing review.
   * @param {SubmissionUploadReviewScope} scope Existing review scope.
   * @param {string} submissionUploadReviewId Existing review identifier.
   * @returns {void}
   */
  const handleOpenSubmissionUploadReview = (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope,
    submissionUploadReviewId: string
  ): void => {
    navigate(
      `/admin/submission/${upload.submission_id}/upload/${upload.submission_upload_id}/review/${scope}/${submissionUploadReviewId}`
    );
  };

  /**
   * Opens the confirmation dialog for accepting or denying a submission upload.
   * The dialog callback is the only place that calls the final decision handler so accidental button clicks do not persist.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload receiving the final review decision.
   * @param {Exclude<SubmissionUploadReviewStatusUpdate, 'submitted'>} nextStatus Final status that will be persisted if confirmed.
   * @returns {void}
   */
  const handleConfirmSubmissionUploadReviewStatusUpdate = (
    upload: TicketSubmissionUploadResponse,
    nextStatus: Exclude<SubmissionUploadReviewStatusUpdate, 'submitted'>
  ): void => {
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

  /**
   * Opens the confirmation dialog for clearing an accepted or rejected submission upload decision.
   * Confirming writes the backend `submitted` status, which returns the upload to the no-decision review state.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload whose final decision should be reset.
   * @returns {void}
   */
  const handleConfirmSubmissionUploadReviewStatusReset = (upload: TicketSubmissionUploadResponse): void => {
    openConfirmationDialog({
      dialogTitle: 'Confirm Reset',
      dialogText: 'Are you sure you want to reset this submission upload decision?',
      yesButtonLabel: 'Reset',
      onConfirm: async () => {
        await handleSubmissionUploadReviewStatusUpdate(upload, 'submitted');
      }
    });
  };

  return {
    handleCreateSubmissionUploadReview,
    handleOpenSubmissionUploadReview,
    handleConfirmSubmissionUploadReviewStatusUpdate,
    handleConfirmSubmissionUploadReviewStatusReset
  };
};
