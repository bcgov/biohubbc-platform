import {
  TICKET_ATTACHMENT_IMAGE_FILE_EXTENSIONS,
  TICKET_ATTACHMENT_MARKDOWN_FORMATTERS,
  TICKET_ATTACHMENT_MARKDOWN_TYPE_BY_MEDIA_TYPE,
  TicketAttachmentMarkdownType
} from 'constants/ticket';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketArtifact, ITicketCommentLog } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

/**
 * Comment state and submit behavior for ticket details.
 *
 * @return {*}
 */
export const useTicketComment = () => {
  const api = useApi();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const config = useConfigContext();
  const authStateContext = useAuthStateContext();
  const dialogContext = useDialogContext();

  const [comment, setComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  /**
   * Determine the markdown rendering type for an uploaded attachment.
   *
   * Browser `File.type` values are MIME types such as `image/png`, so the first
   * segment maps image MIME types to markdown image syntax. Some browsers or
   * operating systems may provide an empty MIME type, so image file extensions
   * are used as a fallback before defaulting to a standard markdown link.
   *
   * @param {File} file File selected by the user.
   * @returns {TicketAttachmentMarkdownType} Markdown formatter type for the file.
   */
  const getAttachmentMarkdownType = (file: File): TicketAttachmentMarkdownType => {
    const mediaType = file.type.split('/')[0]?.toLowerCase();
    const markdownType = mediaType ? TICKET_ATTACHMENT_MARKDOWN_TYPE_BY_MEDIA_TYPE[mediaType] : undefined;

    if (markdownType) {
      return markdownType;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();

    return extension && TICKET_ATTACHMENT_IMAGE_FILE_EXTENSIONS.has(extension) ? 'image' : 'link';
  };

  /**
   * Convert an uploaded ticket attachment into the markdown syntax inserted into
   * the comment draft.
   *
   * The file's markdown type is resolved from its MIME type, with a file
   * extension fallback when MIME metadata is unavailable, and then formatted
   * through `TICKET_ATTACHMENT_MARKDOWN_FORMATTERS`. Image files are inserted as
   * markdown images so the preview renders them as attachment image references.
   * Other files are inserted as standard markdown links. Both variants use the
   * stable `ticket_artifact_id` returned after the upload is completed.
   *
   * @param {File} file File selected by the user.
   * @param {string} ticketArtifactId Stable ticket artifact identifier.
   * @returns {string} Markdown image or link text for the uploaded attachment.
   */
  const getArtifactMarkdownByMimeType = (file: File, ticketArtifactId: string) => {
    const label = file.name;
    const href = `/artifact/${ticketArtifactId}`;
    const markdownType = getAttachmentMarkdownType(file);

    return TICKET_ATTACHMENT_MARKDOWN_FORMATTERS[markdownType](label, href);
  };

  /**
   * Append a newly created comment to the locally cached ticket details.
   *
   * Used by optimistic comment creation so the UI can show a submitted comment
   * immediately before the API request resolves. If the ticket details have not
   * loaded yet, the cache is left unchanged.
   *
   * @param {ITicketCommentLog} newComment Comment to append to the cache.
   * @returns {void}
   */
  const appendComment = (newComment: ITicketCommentLog) => {
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      comments: [...latestTicket.comments, newComment]
    });
  };

  /**
   * Remove a comment from the locally cached ticket details by identifier.
   *
   * Used to roll back an optimistic comment when the create request fails or
   * returns no persisted comment. If the ticket details have not loaded yet, the
   * cache is left unchanged.
   *
   * @param {string} ticketCommentId Comment identifier to remove.
   * @returns {void}
   */
  const removeCommentById = (ticketCommentId: string) => {
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      comments: latestTicket.comments.filter((existingComment) => existingComment.ticket_comment_id !== ticketCommentId)
    });
  };

  /**
   * Replace an optimistic cached comment with the API-persisted comment.
   *
   * When the optimistic comment is still present, this updates it in place so
   * comment order remains stable. If the optimistic comment is missing, the
   * persisted comment is appended so the cache still reflects the successful API
   * response.
   *
   * @param {string} ticketCommentId Optimistic comment identifier to replace.
   * @param {ITicketCommentLog} replacementComment Persisted comment returned by the API.
   * @returns {void}
   */
  const replaceCommentById = (ticketCommentId: string, replacementComment: ITicketCommentLog) => {
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    const hasOptimisticComment = latestTicket.comments.some(
      (existingComment) => existingComment.ticket_comment_id === ticketCommentId
    );

    if (!hasOptimisticComment) {
      ticketDataLoader.setData({
        ...latestTicket,
        comments: [...latestTicket.comments, replacementComment]
      });
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      comments: latestTicket.comments.map((existingComment) =>
        existingComment.ticket_comment_id === ticketCommentId ? replacementComment : existingComment
      )
    });
  };

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
      comment: trimmedComment,
      artifacts: []
    };

    try {
      setIsSavingComment(true);
      appendComment(optimisticComment);

      const createdComment = await api.tickets.createTicketComment(ticketId, {
        comment: trimmedComment
      });

      if (!createdComment) {
        removeCommentById(optimisticCommentId);
        throw new Error('Failed to add comment.');
      }

      const persistedComment: ITicketCommentLog = {
        ticket_comment_id: createdComment.ticket_comment_id ?? optimisticCommentId,
        ticket_id: createdComment.ticket_id,
        user_identifier: createdComment.user_identifier ?? optimisticComment.user_identifier,
        create_date: createdComment.create_date ?? optimisticComment.create_date,
        comment: createdComment.comment ?? trimmedComment,
        artifacts: createdComment.artifacts ?? []
      };

      replaceCommentById(optimisticCommentId, persistedComment);

      setComment('');
    } catch (caughtError) {
      removeCommentById(optimisticCommentId);
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
    const maxTicketAttachmentFileSize = config.MAX_TICKET_ATTACHMENT_FILE_SIZE;

    if (file.size > maxTicketAttachmentFileSize) {
      const maxTicketAttachmentFileSizeMB = Math.round(maxTicketAttachmentFileSize / 1024 / 1024);

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: `Attachment exceeds the ${maxTicketAttachmentFileSizeMB} MB limit.`
      });
      return;
    }

    try {
      setIsUploadingAttachment(true);

      const initializedUpload = await api.tickets.createTicketUpload(ticketId, {
        file_name: file.name,
        byte_size: file.size,
        content_type: file.type || 'application/octet-stream'
      });

      const uploadResponse = await fetch(initializedUpload.presigned_upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload attachment.');
      }

      const ticketArtifact = await api.tickets.completeTicketUpload(ticketId, initializedUpload.upload_id, {
        status: 'uploaded'
      });
      const markdownLink = getArtifactMarkdownByMimeType(file, ticketArtifact.ticket_artifact_id);

      const latestTicket = ticketDataLoader.data;
      if (latestTicket) {
        ticketDataLoader.setData({
          ...latestTicket,
          artifacts: latestTicket.artifacts.some(
            (artifact: ITicketArtifact) => artifact.ticket_artifact_id === ticketArtifact.ticket_artifact_id
          )
            ? latestTicket.artifacts
            : [...latestTicket.artifacts, ticketArtifact]
        });
      }

      setComment((previousComment) => {
        if (!previousComment) {
          return markdownLink;
        }

        const separator = /\s$/.test(previousComment) ? '' : ' ';
        return `${previousComment}${separator}${markdownLink}`;
      });
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message || 'Failed to upload attachment.'
      });
    } finally {
      setIsUploadingAttachment(false);
    }
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
