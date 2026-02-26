import { useTicketContext } from 'hooks/useContext';
import { Dispatch, SetStateAction } from 'react';
import { useTicketComment } from '../hooks/useTicketComment';
import { TicketComment } from './TicketComment';

interface ITicketCommentSectionProps {
  isTicketOpen: boolean;
  onSavingChange: Dispatch<SetStateAction<boolean>>;
}

/**
 * Owns ticket comment state and submit behavior.
 *
 * @param {ITicketCommentSectionProps} props
 * @return {*}
 */
export const TicketCommentSection = (props: ITicketCommentSectionProps) => {
  const { isTicketOpen, onSavingChange } = props;
  const { ticketId, ticketDataLoader } = useTicketContext();
  const handleRefresh = async () => {
    await ticketDataLoader.refresh(ticketId);
  };
  const { comment, setComment, isSavingComment, handleAddComment } = useTicketComment({
    ticketId,
    onRefreshTicket: handleRefresh,
    onSavingChange
  });

  if (!isTicketOpen) {
    return null;
  }

  return (
    <TicketComment
      comment={comment}
      setComment={setComment}
      isSaving={isSavingComment}
      onAddComment={handleAddComment}
    />
  );
};
