import { getArtifactMarkdownByMimeType } from 'features/admin/tickets/utils/ticketArtifactMarkdown';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketCommentLog } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { useTicketAttachmentUpload } from './useTicketAttachmentUpload';
import { useTicketCommentCache } from './useTicketCommentCache';

/**
 * Comment state and submit behavior for ticket details.
 *
 * @return {*}
 */
export const useTicketComment = () => {
  const api = useApi();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const authStateContext = useAuthStateContext();
  const dialogContext = useDialogContext();
  const { isUploadingAttachment, uploadTicketAttachment } = useTicketAttachmentUpload({ ticketId });
  const { appendCachedComment, removeCachedComment, replaceCachedComment } = useTicketCommentCache();

  const [comment, setComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  /**
   * Submit the current comment draft for the active ticket.
   *
   * Empty or whitespace-only drafts are ignored. Valid drafts are added
   * optimistically, then replaced with the API response on success. Failures roll
   * back the optimistic comment and surface the API error through the snackbar.
   *
   * @returns {Promise<void>} Resolves when the submit attempt has completed.
   */
  const handleAddComment = async () => {
    const trimmedComment = comment.trim();

    if (!trimmedComment) {
      return;
    }

    const currentTicket = ticketDataLoader.data;

    if (!currentTicket) {
      return;
    }

    const optimisticCommentId = `optimistic-${Date.now()}`;
    const optimisticComment: ITicketCommentLog = {
      ticket_comment_id: optimisticCommentId,
      ticket_id: currentTicket.ticket_id,
      user_identifier: authStateContext.biohubUserWrapper.userIdentifier ?? 'unknown',
      create_date: new Date().toISOString(),
      comment: trimmedComment
    };

    try {
      setIsSavingComment(true);
      appendCachedComment(optimisticComment);

      const createdComment = await api.tickets.createTicketComment(ticketId, {
        comment: trimmedComment
      });

      if (!createdComment) {
        removeCachedComment(optimisticCommentId);
        throw new Error('Failed to add comment.');
      }

      const persistedComment: ITicketCommentLog = {
        ticket_comment_id: createdComment.ticket_comment_id ?? optimisticCommentId,
        ticket_id: createdComment.ticket_id,
        user_identifier: createdComment.user_identifier ?? optimisticComment.user_identifier,
        create_date: createdComment.create_date ?? optimisticComment.create_date,
        comment: createdComment.comment ?? trimmedComment
      };

      replaceCachedComment(optimisticCommentId, persistedComment);

      setComment('');
    } catch (caughtError) {
      removeCachedComment(optimisticCommentId);
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingComment(false);
    }
  };

  /**
   * Upload a selected file as a ticket attachment and append its markdown link
   * to the comment draft.
   *
   * The upload flow initializes a ticket upload, uploads the file to the
   * presigned object-store URL, completes the ticket upload, adds the returned
   * ticket artifact to the cached ticket details if needed, and appends markdown
   * that references the stable `ticket_artifact_id`. Failures surface through
   * the snackbar and leave the draft unchanged.
   *
   * @param {File} file File selected by the user for upload.
   * @returns {Promise<void>} Resolves when the upload attempt has completed.
   */
  const handleUploadAttachment = async (file: File) => {
    const ticketArtifact = await uploadTicketAttachment(file);

    if (!ticketArtifact) {
      return;
    }

    const markdownLink = getArtifactMarkdownByMimeType(file, ticketArtifact.ticket_artifact_id);

    setComment((previousComment) => {
      if (!previousComment) {
        return markdownLink;
      }

      const separator = /\s$/.test(previousComment) ? '' : ' ';
      return `${previousComment}${separator}${markdownLink}`;
    });
  };

  return {
    comment,
    setComment,
    isSavingComment,
    isUploadingAttachment,
    handleAddComment,
    handleUploadAttachment
  };
};
