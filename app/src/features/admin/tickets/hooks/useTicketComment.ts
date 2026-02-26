import { APIError } from 'hooks/api/useAxios';
import { useDialogContext } from 'hooks/useContext';
import { Dispatch, SetStateAction, useState } from 'react';

interface IUseTicketCommentProps {
  onSubmitComment: (comment: string) => Promise<void>;
  onSavingChange: Dispatch<SetStateAction<boolean>>;
}

/**
 * Comment state and submit behavior for ticket details.
 *
 * @param {IUseTicketCommentProps} props
 * @return {*}
 */
export const useTicketComment = (props: IUseTicketCommentProps) => {
  const { onSubmitComment, onSavingChange } = props;
  const dialogContext = useDialogContext();

  const [comment, setComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  const handleAddComment = async () => {
    if (!comment.trim()) {
      return;
    }

    try {
      setIsSavingComment(true);
      onSavingChange(true);
      const trimmedComment = comment.trim();
      await onSubmitComment(trimmedComment);
      setComment('');
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
