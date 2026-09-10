import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import {
  IUpdateSubmissionUploadDecisionRequest,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewTaskStatus,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';
import { useTicketTimelineConfirmationDialog } from '../useTicketTimelineConfirmationDialog';

type SubmissionUploadDecisionUpdate = IUpdateSubmissionUploadDecisionRequest['decision'];

/**
 * Submission upload decision and review handlers for the ticket timeline.
 *
 * @returns Timeline upload action handlers.
 */
export const useTicketTimelineUploadActions = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const { openConfirmationDialog } = useTicketTimelineConfirmationDialog();

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
   * Replaces the cached decision for one upload after the backend records it.
   * This is only used for the upload-level decision row and intentionally leaves scoped review tasks unchanged.
   *
   * @param {string} submissionUploadId Submission upload being updated in the ticket cache.
   * @param {TicketSubmissionUploadResponse['decision']} decision Backend-confirmed upload decision.
   * @returns {void}
   */
  const setCachedUploadDecision = (
    submissionUploadId: string,
    decision: TicketSubmissionUploadResponse['decision']
  ): void => {
    updateCachedSubmissionUpload(submissionUploadId, (upload) => ({ ...upload, decision }));
  };

  /**
   * Replaces one scoped upload review in the cached ticket after an update response.
   * The backend response is treated as the source of truth, so this does not derive fields from stale row state.
   *
   * @param {TicketSubmissionUploadReviewResponse} review Backend-confirmed scoped review record.
   * @returns {void}
   */
  const setCachedUploadReview = (review: TicketSubmissionUploadReviewResponse): void => {
    updateCachedSubmissionUpload(review.submission_upload_id, (upload) => ({
      ...upload,
      reviews: {
        ...upload.reviews,
        [review.scope]: review
      }
    }));
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
   * Persists an upload-level decision and updates the cached upload with the backend response.
   * Use this only from the confirmation dialog callback, after the reviewer has confirmed the decision.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload receiving the decision.
   * @param {SubmissionUploadDecisionUpdate} nextDecision Decision to persist.
   * @returns {Promise<void>} Resolves after the backend response has been reflected in local ticket state.
   */
  const handleSubmissionUploadDecisionUpdate = async (
    upload: TicketSubmissionUploadResponse,
    nextDecision: SubmissionUploadDecisionUpdate
  ): Promise<void> => {
    try {
      const updated = await api.tickets.updateSubmissionUploadDecision(
        upload.submission_uuid,
        upload.submission_upload_id,
        {
          decision: nextDecision
        }
      );

      setCachedUploadDecision(upload.submission_upload_id, updated.decision);
    } catch (error) {
      showUploadActionError(error);
    }
  };

  /**
   * Updates the status of an existing scoped upload review task.
   * Use this from review rows that already have a backend review record and therefore know the review id to patch.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload that owns the review task.
   * @param {TicketSubmissionUploadReviewResponse} review Existing review task being updated.
   * @param {SubmissionUploadReviewTaskStatus} nextStatus Status selected by the reviewer.
   * @returns {Promise<void>} Resolves after the backend response has replaced the cached review.
   */
  const handleUpdateSubmissionUploadReview = async (
    upload: TicketSubmissionUploadResponse,
    review: TicketSubmissionUploadReviewResponse,
    nextStatus: SubmissionUploadReviewTaskStatus
  ): Promise<void> => {
    try {
      const updatedReview = await api.tickets.updateSubmissionUploadReview(
        upload.submission_uuid,
        upload.submission_upload_id,
        review.submission_upload_review_id,
        { status: nextStatus }
      );

      setCachedUploadReview(updatedReview);
    } catch (error) {
      showUploadActionError(error);
    }
  };

  /**
   * Requests a replacement review for one scoped upload task and caches the backend-created row.
   * Use this from missing review rows only; existing rows should either navigate to the review page or patch status.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload that owns the review task.
   * @param {SubmissionUploadReviewScope} scope Review scope being requested.
   * @returns {Promise<void>} Resolves after the backend-created review is reflected in local ticket state.
   */
  const handleRequestSubmissionUploadReview = async (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope
  ): Promise<void> => {
    try {
      const insertedReview = await api.tickets.insertSubmissionUploadReview(
        upload.submission_uuid,
        upload.submission_upload_id,
        {
          scope,
          status: 'requested'
        }
      );

      setCachedUploadReview(insertedReview);
    } catch (error) {
      showUploadActionError(error);
    }
  };

  /**
   * Opens the confirmation dialog for accepting or denying a submission upload.
   * The dialog callback is the only place that calls the final decision handler so accidental button clicks do not persist.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload receiving the decision.
   * @param {Exclude<SubmissionUploadDecisionUpdate, 'pending'>} nextDecision Decision that will be persisted if confirmed.
   * @returns {void}
   */
  const handleConfirmSubmissionUploadDecisionUpdate = (
    upload: TicketSubmissionUploadResponse,
    nextDecision: Exclude<SubmissionUploadDecisionUpdate, 'pending'>
  ): void => {
    const isApproval = nextDecision === 'approved';

    openConfirmationDialog({
      dialogTitle: isApproval ? 'Confirm Acceptance' : 'Confirm Rejection',
      dialogText: isApproval
        ? 'Are you sure you want to accept this submission upload?'
        : 'Are you sure you want to reject this submission upload?',
      yesButtonLabel: isApproval ? 'Accept' : 'Reject',
      onConfirm: async () => {
        await handleSubmissionUploadDecisionUpdate(upload, nextDecision);
      }
    });
  };

  /**
   * Opens the confirmation dialog for clearing an accepted or rejected submission upload decision.
   * Confirming writes the `pending` decision, which returns the upload to the no-decision review state.
   *
   * @param {TicketSubmissionUploadResponse} upload Upload whose decision should be reset.
   * @returns {void}
   */
  const handleConfirmSubmissionUploadDecisionReset = (upload: TicketSubmissionUploadResponse): void => {
    openConfirmationDialog({
      dialogTitle: 'Confirm Reset',
      dialogText: 'Are you sure you want to reset this submission upload decision?',
      yesButtonLabel: 'Reset',
      onConfirm: async () => {
        await handleSubmissionUploadDecisionUpdate(upload, 'pending');
      }
    });
  };

  return {
    handleRequestSubmissionUploadReview,
    handleUpdateSubmissionUploadReview,
    handleConfirmSubmissionUploadDecisionUpdate,
    handleConfirmSubmissionUploadDecisionReset
  };
};
