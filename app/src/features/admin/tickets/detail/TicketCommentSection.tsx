import { Dispatch, SetStateAction } from 'react';
import { useTicketComment } from '../hooks/useTicketComment';
import { TicketComment } from './TicketComment';

interface ITicketCommentSectionProps {
  ticketId?: string;
  isTicketOpen: boolean;
  isSavingStatus: boolean;
  onRefreshTicket: () => Promise<void>;
  onError: (message: string | undefined) => void;
  onSavingChange: Dispatch<SetStateAction<boolean>>;
}

/**
 * Owns ticket comment state and submit behavior.
 *
 * @param {ITicketCommentSectionProps} props
 * @return {*}
 */
export const TicketCommentSection = (props: ITicketCommentSectionProps) => {
  const { ticketId, isTicketOpen, isSavingStatus, onRefreshTicket, onError, onSavingChange } = props;
  const { comment, setComment, isSavingComment, handleAddComment } = useTicketComment({
    ticketId,
    onRefreshTicket,
    onError,
    onSavingChange
  });

  if (!isTicketOpen) {
    return null;
  }

  return (
    <TicketComment
      comment={comment}
      setComment={setComment}
      isSaving={isSavingComment || isSavingStatus}
      onAddComment={handleAddComment}
    />
  );
};
