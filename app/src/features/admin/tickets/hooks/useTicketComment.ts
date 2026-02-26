import { APIError } from 'hooks/api/useAxios';
import { useDialogContext } from 'hooks/useContext';
import { useApi } from 'hooks/useApi';
import { Dispatch, SetStateAction, useState } from 'react';

interface IUseTicketCommentProps {
  ticketId?: string;
  onRefreshTicket: () => Promise<void>;
  onSavingChange: Dispatch<SetStateAction<boolean>>;
}

/**
 * Comment state and submit behavior for ticket details.
 *
 * @param {IUseTicketCommentProps} props
 * @return {*}
 */
export const useTicketComment = (props: IUseTicketCommentProps) => {
  const { ticketId, onRefreshTicket, onSavingChange } = props;
  const api = useApi();
  const dialogContext = useDialogContext();

  const [comment, setComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  const handleAddComment = async () => {
    if (!ticketId || !comment.trim()) {
      return;
    }

    try {
      setIsSavingComment(true);
      onSavingChange(true);

      await api.tickets.createTicketComment(ticketId, { comment: comment.trim() });
      setComment('');
      await onRefreshTicket();
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message || 'Failed to add comment.'
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
