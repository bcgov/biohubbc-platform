import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DropdownButtonGroup } from 'components/DropdownButtonGroup';
import {
  SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX,
  SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_LABELS,
  SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_OPTIONS
} from 'constants/submission-upload-status';
import { SubmissionUploadReviewTaskStatus } from 'interfaces/useTicketsApi.interface';
import { useNavigate } from 'react-router-dom';
import { ITicketUploadReviewRowProps } from '../TicketUploadTimelineItem.interface';

/**
 * Displays and updates one scoped human review task on the upload timeline card.
 *
 * @param {ITicketUploadReviewRowProps} props
 * @return {*}
 */
export const TicketUploadReviewRow = (props: ITicketUploadReviewRowProps) => {
  const { label, scope, upload, review, onRequestReview, onUpdateReview } = props;
  const navigate = useNavigate();
  const reviewStatus = review?.status ?? 'requested';

  const getReviewStatusLabel = (status: SubmissionUploadReviewTaskStatus) =>
    status === 'requested' ? 'Open' : SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_LABELS[status];

  const reviewRoute = review
    ? `/admin/submission/${upload.submission_uuid}/upload/${upload.submission_upload_id}/review/${review.submission_upload_review_id}`
    : null;

  const reviewButtonColorByStatus: Partial<Record<SubmissionUploadReviewTaskStatus, 'primary' | 'success'>> = {
    requested: 'primary',
    completed: 'success'
  };
  const reviewButtonColor = reviewButtonColorByStatus[reviewStatus];

  return (
    <Box
      sx={{
        px: 2,
        py: 2,
        minHeight: 64,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2
      }}>
      <Typography variant="body2" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      {review ? (
        <DropdownButtonGroup
          value={reviewStatus}
          primaryLabel={getReviewStatusLabel(reviewStatus)}
          itemGroups={[{ groupId: `${scope}-review-status`, items: SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_OPTIONS }]}
          size="small"
          variant="contained"
          color={reviewButtonColor}
          sx={reviewButtonColor ? undefined : SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX}
          onPrimaryClick={() => reviewRoute && navigate(reviewRoute)}
          onSelect={(value) => onUpdateReview(upload, review, value as SubmissionUploadReviewTaskStatus)}
        />
      ) : (
        <Button
          size="small"
          variant="contained"
          sx={SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX}
          onClick={() => onRequestReview(upload, scope)}>
          Request Review
        </Button>
      )}
    </Box>
  );
};
