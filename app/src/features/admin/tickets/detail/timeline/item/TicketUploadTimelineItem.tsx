import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { TicketTimelineItem } from './TicketTimelineItem';
import { TicketUploadDecisionRow } from './upload/decision/TicketUploadDecisionRow';
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
  const { upload, dateLabel, onUpdateReview, onAccept, onReject } = props;
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

        <TicketUploadReviewRow label="Validation" scope="validation" upload={upload} onUpdateReview={onUpdateReview} />
        <TicketUploadReviewRow
          label="Security Review"
          scope="security"
          upload={upload}
          onUpdateReview={onUpdateReview}
        />

        <TicketUploadDecisionRow upload={upload} onAccept={onAccept} onReject={onReject} />
      </Box>
    </TicketTimelineItem>
  );
};
