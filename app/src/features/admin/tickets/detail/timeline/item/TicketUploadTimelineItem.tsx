import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { TicketTimelineItem } from './layout/TicketTimelineItem';
import { TicketUploadDecisionRow } from './upload/decision/TicketUploadDecisionRow';
import { TicketUploadReviewRequestRow } from './upload/review/TicketUploadReviewRequestRow';
import { TicketUploadReviewRow } from './upload/review/TicketUploadReviewRow';
import { TicketUploadStatusRow } from './upload/status/TicketUploadStatusRow';
import { ITicketUploadTimelineItemProps } from './upload/TicketUploadTimelineItem.interface';

/**
 * Ticket timeline event card for a submission upload.
 *
 * @param {ITicketUploadTimelineItemProps} props
 * @return {*}
 */
export const TicketUploadTimelineItem = (props: ITicketUploadTimelineItemProps) => {
  const { upload, dateLabel, onRequestReview, onUpdateReview, onAccept, onReject, onResetDecision } = props;
  const bodyText =
    upload.submission_comment ||
    upload.submission_description ||
    `Submission upload ${upload.submission_upload_id.slice(0, 8)}`;

  return (
    <TicketTimelineItem title="New Submission" dateLabel={dateLabel}>
      <Box sx={{ mx: -2, my: -2 }}>
        <Box sx={{ px: 2, py: 2.5 }}>
          <Typography variant="body2">{bodyText}</Typography>
        </Box>

        <TicketUploadStatusRow upload={upload} />

        {upload.reviews.validation ? (
          <TicketUploadReviewRow
            label="Validation"
            upload={upload}
            review={upload.reviews.validation}
            onUpdateReview={onUpdateReview}
          />
        ) : (
          <TicketUploadReviewRequestRow
            label="Validation"
            scope="validation"
            upload={upload}
            onRequestReview={onRequestReview}
          />
        )}
        {upload.reviews.security ? (
          <TicketUploadReviewRow
            label="Security Review"
            upload={upload}
            review={upload.reviews.security}
            onUpdateReview={onUpdateReview}
          />
        ) : (
          <TicketUploadReviewRequestRow
            label="Security Review"
            scope="security"
            upload={upload}
            onRequestReview={onRequestReview}
          />
        )}

        <TicketUploadDecisionRow
          upload={upload}
          onAccept={onAccept}
          onReject={onReject}
          onResetDecision={onResetDecision}
        />
      </Box>
    </TicketTimelineItem>
  );
};
