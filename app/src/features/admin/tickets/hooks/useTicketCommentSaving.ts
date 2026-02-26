import { useState } from 'react';

/**
 * Tracks whether a ticket comment is currently being saved.
 *
 * @return {*}
 */
export const useTicketCommentSaving = () => {
  const [isSavingComment, setIsSavingComment] = useState(false);

  return {
    isSavingComment,
    setIsSavingComment
  };
};

