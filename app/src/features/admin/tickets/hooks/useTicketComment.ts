import { getArtifactMarkdownByMimeType } from 'features/admin/tickets/utils/ticketArtifactMarkdown';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
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
  const dialogContext = useDialogContext();
  const { isUploadingAttachment, uploadTicketAttachment } = useTicketAttachmentUpload({ ticketId });
  const { appendCachedComment } = useTicketCommentCache();

  const [comment, setComment] = useState('');
  const [commentArtifacts, setCommentArtifacts] = useState<ITicketArtifact[]>([]);
  const [isSavingComment, setIsSavingComment] = useState(false);

  /**
   * Submit the current comment draft for the active ticket.
   *
   * Empty or whitespace-only drafts are ignored. Valid drafts are submitted to
   * the API, then the returned comment is appended to the cached ticket details
   * with server-populated artifact metadata.
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

    try {
      setIsSavingComment(true);

      const createdComment = await api.tickets.createTicketComment(ticketId, {
        comment: trimmedComment
      });

      if (!createdComment) {
        throw new Error('Failed to add comment.');
      }

      appendCachedComment(createdComment);

      setComment('');
      setCommentArtifacts([]);
    } catch (caughtError) {
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
    setCommentArtifacts((previousArtifacts) =>
      previousArtifacts.some((artifact) => artifact.ticket_artifact_id === ticketArtifact.ticket_artifact_id)
        ? previousArtifacts
        : [...previousArtifacts, ticketArtifact]
    );

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
    commentArtifacts,
    setComment,
    isSavingComment,
    isUploadingAttachment,
    handleAddComment,
    handleUploadAttachment
  };
};
