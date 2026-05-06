import Box from '@mui/material/Box';
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
  const { label, scope, upload, onUpdateReview } = props;
  const navigate = useNavigate();
  const review = upload.reviews.find((item) => item.scope === scope);
  const reviewStatus = review?.status ?? 'requested';
  const primaryLabel =
    reviewStatus === 'requested' ? 'Open' : SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_LABELS[reviewStatus];
  const reviewButtonColor =
    reviewStatus === 'requested' ? 'primary' : reviewStatus === 'completed' ? 'success' : undefined;

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
          primaryLabel={primaryLabel}
          itemGroups={[{ groupId: `${scope}-review-status`, items: SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_OPTIONS }]}
          size="small"
          variant="contained"
          color={reviewButtonColor}
          sx={reviewButtonColor ? undefined : SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX}
          onPrimaryClick={() =>
            navigate(
              `/admin/submission/${upload.submission_uuid}/upload/${upload.submission_upload_id}/review/${review.submission_upload_review_id}`
            )
          }
          onSelect={(value) => onUpdateReview(upload, scope, value as SubmissionUploadReviewTaskStatus)}
        />
      ) : (
        <DropdownButtonGroup
          value="requested"
          primaryLabel="Request"
          itemGroups={[{ groupId: `${scope}-review-status`, items: SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_OPTIONS }]}
          size="small"
          variant="contained"
          sx={SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX}
          onSelect={(value) => onUpdateReview(upload, scope, value as SubmissionUploadReviewTaskStatus)}
        />
      )}
    </Box>
  );
};
