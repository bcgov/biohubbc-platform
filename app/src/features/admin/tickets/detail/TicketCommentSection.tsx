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
  const { handleComment } = useTicketContext();

  const { comment, setComment, isSavingComment, handleAddComment } = useTicketComment({
    onSubmitComment: handleComment,
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
