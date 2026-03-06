import { APIError } from 'hooks/api/useAxios';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { useApi } from 'hooks/useApi';
import { ITicketCommentLog } from 'interfaces/useTicketsApi.interface';
import { Dispatch, SetStateAction, useState } from 'react';

interface IUseTicketCommentProps {
  onSavingChange: Dispatch<SetStateAction<boolean>>;
}

/**
 * Comment state and submit behavior for ticket details.
 *
 * @param {IUseTicketCommentProps} props
 * @return {*}
 */
export const useTicketComment = (props: IUseTicketCommentProps) => {
  const { onSavingChange } = props;
  const api = useApi();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const authStateContext = useAuthStateContext();
  const dialogContext = useDialogContext();

  const [comment, setComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

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
      onSavingChange(true);
      appendComment(optimisticComment);

      const createdComment = await api.tickets.createTicketComment(ticketId, { comment: trimmedComment });

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
      onSavingChange(false);
    }
  };

  return {
    comment,
    setComment,
    isSavingComment,
    handleAddComment
  };
};
