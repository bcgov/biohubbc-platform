import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { Dispatch, SetStateAction, useState } from 'react';

interface IUseTicketCommentProps {
  ticketId?: string;
  onRefreshTicket: () => Promise<void>;
  onError: (message: string | undefined) => void;
  onSavingChange: Dispatch<SetStateAction<boolean>>;
}

/**
 * Comment state and submit behavior for ticket details.
 *
 * @param {IUseTicketCommentProps} props
 * @return {*}
 */
export const useTicketComment = (props: IUseTicketCommentProps) => {
  const { ticketId, onRefreshTicket, onError, onSavingChange } = props;
  const api = useApi();

  const [comment, setComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  const handleAddComment = async () => {
    if (!ticketId || !comment.trim()) {
      return;
    }

    try {
      setIsSavingComment(true);
      onSavingChange(true);
      onError(undefined);

      await api.tickets.createTicketComment(ticketId, { comment: comment.trim() });
      setComment('');
      await onRefreshTicket();
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      onError(apiError.message || 'Failed to add comment.');
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

