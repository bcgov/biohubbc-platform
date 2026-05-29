import { DropdownButton } from 'components/DropdownButton';
import {
  SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_BUTTON_COLORS,
  SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_OPTIONS
} from 'constants/submission-upload-status';
import { SubmissionUploadReviewTaskStatus } from 'interfaces/useTicketsApi.interface';

interface ITicketUploadReviewDropdownProps {
  value: SubmissionUploadReviewTaskStatus;
  onPending: () => void;
  onRequested: () => void;
  onInProgress: () => void;
  onCompleted: () => void;
  onBlocked: () => void;
  onSkipped: () => void;
  onCancelled: () => void;
}

/**
 * Status dropdown for an active submission upload review task.
 *
 * @param {ITicketUploadReviewDropdownProps} props
 * @return {*}
 */
export const TicketUploadReviewDropdown = (props: ITicketUploadReviewDropdownProps) => {
  const { value, onPending, onRequested, onInProgress, onCompleted, onBlocked, onSkipped, onCancelled } = props;

  const reviewButtonColor = SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_BUTTON_COLORS[value];
  const handleSelect = (nextValue: string) => {
    const statusHandlers: Record<SubmissionUploadReviewTaskStatus, () => void> = {
      pending: onPending,
      requested: onRequested,
      in_progress: onInProgress,
      completed: onCompleted,
      blocked: onBlocked,
      skipped: onSkipped,
      cancelled: onCancelled
    };

    statusHandlers[nextValue as SubmissionUploadReviewTaskStatus]();
  };

  return (
    <DropdownButton
      value={value}
      itemGroups={[{ groupId: 'submission-upload-review-status', items: SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_OPTIONS }]}
      size="small"
      variant="contained"
      color={reviewButtonColor ?? undefined}
      sx={
        reviewButtonColor
          ? {
              bgcolor: `${reviewButtonColor}.main`,
              color: `${reviewButtonColor}.contrastText`,
              '&:hover': {
                bgcolor: `${reviewButtonColor}.dark`
              }
            }
          : {
              bgcolor: 'grey.200',
              color: 'text.primary',
              '&:hover': {
                bgcolor: 'grey.300'
              }
            }
      }
      onSelect={handleSelect}
    />
  );
};
