import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  SubmissionUploadReviewScope,
  SubmissionUploadReviewTaskStatus,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';
import { TicketTimelineItem } from './TicketTimelineItem';

interface ITicketUploadTimelineItemProps {
  upload: TicketSubmissionUploadResponse;
  dateLabel: string;
  isUpdating: boolean;
  onUpdateReview: (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope,
    status: SubmissionUploadReviewTaskStatus
  ) => void;
  onAccept: (upload: TicketSubmissionUploadResponse) => void;
  onReject: (upload: TicketSubmissionUploadResponse) => void;
}

const REQUIRED_REVIEW_SCOPES: SubmissionUploadReviewScope[] = ['validation', 'security'];

const REVIEW_STATUS_LABELS: Record<SubmissionUploadReviewTaskStatus, string> = {
  requested: 'Ready for review',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Blocked',
  skipped: 'Skipped',
  cancelled: 'Cancelled'
};

const shortId = (value: string) => value.slice(0, 8);

const getReview = (upload: TicketSubmissionUploadResponse, scope: SubmissionUploadReviewScope) =>
  upload.reviews.find((review) => review.scope === scope);

const isReviewResolved = (review: TicketSubmissionUploadReviewResponse | undefined) =>
  review?.status === 'completed' || review?.status === 'skipped';

const hasBlockedReview = (upload: TicketSubmissionUploadResponse) =>
  upload.reviews.some((review) => review.status === 'blocked');

const areRequiredReviewsResolved = (upload: TicketSubmissionUploadResponse) =>
  REQUIRED_REVIEW_SCOPES.every((scope) => isReviewResolved(getReview(upload, scope)));

const canApproveUpload = (upload: TicketSubmissionUploadResponse) =>
  upload.validation.status === 'completed' &&
  areRequiredReviewsResolved(upload) &&
  !hasBlockedReview(upload) &&
  upload.review_status === 'submitted';

const getUploadTimelineStatusLabel = (upload: TicketSubmissionUploadResponse) => {
  if (upload.review_status === 'approved') {
    return 'Accepted';
  }

  if (upload.review_status === 'denied') {
    return 'Rejected';
  }

  if (upload.validation.status === 'pending' || upload.validation.status === 'started') {
    return 'Validating';
  }

  if (upload.validation.status === 'invalid') {
    return 'Validation failed';
  }

  if (upload.validation.status === 'failed') {
    return 'Validation error';
  }

  if (hasBlockedReview(upload)) {
    return 'Blocked';
  }

  if (canApproveUpload(upload)) {
    return 'Ready for review';
  }

  return 'Submitted';
};

const getStatusColor = (upload: TicketSubmissionUploadResponse) => {
  if (upload.review_status === 'approved' || canApproveUpload(upload)) {
    return 'success.main';
  }

  if (
    upload.review_status === 'denied' ||
    upload.validation.status === 'invalid' ||
    upload.validation.status === 'failed'
  ) {
    return 'error.main';
  }

  if (hasBlockedReview(upload)) {
    return 'warning.main';
  }

  return 'text.secondary';
};

interface IReviewRowProps {
  label: string;
  scope: SubmissionUploadReviewScope;
  upload: TicketSubmissionUploadResponse;
  isUpdating: boolean;
  disabled: boolean;
  onUpdateReview: (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope,
    status: SubmissionUploadReviewTaskStatus
  ) => void;
}

const ReviewRow = (props: IReviewRowProps) => {
  const { label, scope, upload, isUpdating, disabled, onUpdateReview } = props;
  const review = getReview(upload, scope);
  const reviewStatus = review?.status ?? 'requested';
  const statusLabel = REVIEW_STATUS_LABELS[reviewStatus];
  let actions = (
    <Stack direction="row" spacing={1}>
      <Button
        variant="contained"
        color="primary"
        size="small"
        disabled={disabled || isUpdating}
        onClick={() => onUpdateReview(upload, scope, 'in_progress')}>
        {statusLabel}
      </Button>
      <Button
        variant="outlined"
        color="primary"
        size="small"
        disabled={disabled || isUpdating}
        onClick={() => onUpdateReview(upload, scope, 'skipped')}>
        Skip
      </Button>
    </Stack>
  );

  if (reviewStatus === 'in_progress') {
    actions = (
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="success"
          size="small"
          disabled={disabled || isUpdating}
          onClick={() => onUpdateReview(upload, scope, 'completed')}>
          Complete
        </Button>
        <Button
          variant="outlined"
          color="warning"
          size="small"
          disabled={disabled || isUpdating}
          onClick={() => onUpdateReview(upload, scope, 'blocked')}>
          Block
        </Button>
      </Stack>
    );
  } else if (reviewStatus === 'blocked') {
    actions = (
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="primary"
          size="small"
          disabled={disabled || isUpdating}
          onClick={() => onUpdateReview(upload, scope, 'in_progress')}>
          Start Review
        </Button>
        <Button
          variant="outlined"
          color="error"
          size="small"
          disabled={disabled || isUpdating}
          onClick={() => onUpdateReview(upload, scope, 'cancelled')}>
          Cancel
        </Button>
      </Stack>
    );
  } else if (reviewStatus === 'completed' || reviewStatus === 'skipped' || reviewStatus === 'cancelled') {
    actions = (
      <Typography variant="body2" color="text.secondary" fontWeight={700}>
        {statusLabel}
      </Typography>
    );
  }

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
      {actions}
    </Box>
  );
};

/**
 * Ticket timeline event card for a submission upload.
 *
 * @param {ITicketUploadTimelineItemProps} props
 * @return {*}
 */
export const TicketUploadTimelineItem = (props: ITicketUploadTimelineItemProps) => {
  const { upload, dateLabel, isUpdating, onUpdateReview, onAccept, onReject } = props;
  const bodyText =
    upload.submission_comment ||
    upload.submission_description ||
    `Submission upload ${shortId(upload.submission_upload_id)}`;
  const statusLabel = getUploadTimelineStatusLabel(upload);
  const statusColor = getStatusColor(upload);
  const reviewDisabled = upload.validation.status !== 'completed' || upload.review_status !== 'submitted';
  const canReject = upload.review_status === 'submitted';

  return (
    <TicketTimelineItem title="New Submission" dateLabel={dateLabel}>
      <Box sx={{ mx: -2, my: -2 }}>
        <Box sx={{ px: 2, py: 2.5 }}>
          <Typography variant="body2">{bodyText}</Typography>
        </Box>

        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: statusColor,
              flexShrink: 0
            }}
          />
          <Typography variant="body2">{statusLabel}</Typography>
        </Box>

        <ReviewRow
          label="Validation"
          scope="validation"
          upload={upload}
          isUpdating={isUpdating}
          disabled={reviewDisabled}
          onUpdateReview={onUpdateReview}
        />
        <ReviewRow
          label="Security Review"
          scope="security"
          upload={upload}
          isUpdating={isUpdating}
          disabled={reviewDisabled}
          onUpdateReview={onUpdateReview}
        />

        <Box
          sx={{
            px: 2,
            py: 2,
            borderTop: 1,
            borderColor: 'divider'
          }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="success"
              size="small"
              disabled={!canApproveUpload(upload) || isUpdating}
              onClick={() => onAccept(upload)}>
              Accept
            </Button>
            {canReject ? (
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={isUpdating}
                onClick={() => onReject(upload)}>
                Reject
              </Button>
            ) : null}
          </Stack>
        </Box>
      </Box>
    </TicketTimelineItem>
  );
};
