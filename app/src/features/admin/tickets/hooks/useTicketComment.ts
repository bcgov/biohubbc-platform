import { APIError } from 'hooks/api/useAxios';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { useApi } from 'hooks/useApi';
import { ITicketArtifact, ITicketCommentLog } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

const getAttachmentMarkdown = (file: File, ticketArtifactId: string) => {
  const label = file.name;
  const href = `/artifact/${ticketArtifactId}`;

  return file.type.startsWith('image/') ? `![${label}](${href})` : `[${label}](${href})`;
};

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

  const [comment, setComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

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
        comment: createdComment.comment ?? trimmedComment
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

  const handleUploadAttachment = async (file: File) => {
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
      const markdownLink = getAttachmentMarkdown(file, ticketArtifact.ticket_artifact_id);

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

      setComment((previousComment) => `${previousComment}${markdownLink}`);
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
