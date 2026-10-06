import { mdiArrowTopRight } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { SubmissionUploadReviewScope } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { TicketTimelineItem } from './layout/TicketTimelineItem';
import { TicketUploadDecisionRow } from './upload/decision/TicketUploadDecisionRow';
import { CreateReviewDialog } from './upload/review/CreateReviewDialog';
import { ICreateReviewFormValues } from './upload/review/CreateReviewForm.interface';
import { TicketUploadReviewRow } from './upload/review/TicketUploadReviewRow';
import { TicketUploadStatusRow } from './upload/status/TicketUploadStatusRow';
import { ITicketUploadTimelineItemProps } from './upload/TicketUploadTimelineItem.interface';

/**
 * Ticket timeline event card for a submission upload.
 *
 * @param {ITicketUploadTimelineItemProps} props - Component props.
 * @returns {JSX.Element} Ticket timeline item for a submission upload.
 */
export const TicketUploadTimelineItem = (props: ITicketUploadTimelineItemProps) => {
  const { upload, dateLabel, canViewStatusHistory, onCreateReview, onOpenReview, onAccept, onReject, onResetDecision } =
    props;
  const submissionName = upload.submission_name || `Submission upload ${upload.submission_upload_id.slice(0, 8)}`;
  const comment = upload.submission_comment || 'No comment provided.';
  const [createReviewScope, setCreateReviewScope] = useState<SubmissionUploadReviewScope | null>(null);

  const handleCreateReview = (values: ICreateReviewFormValues) => {
    if (!createReviewScope) {
      return;
    }

    onCreateReview(upload, createReviewScope, {
      name: values.name.trim(),
      description: values.description.trim() || null
    });
  };

  return (
    <>
      <TicketTimelineItem title="New Submission" dateLabel={dateLabel}>
        <Box sx={{ mx: -2, my: -2 }}>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography component="h3" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
              <Link
                component={RouterLink}
                to={`/admin/submissions/${upload.submission_id}`}
                underline="always"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  textDecoration: 'underline dashed',
                  textUnderlineOffset: '5px',
                  '&:hover': { textDecoration: 'underline dashed' }
                }}>
                {submissionName}
                <Icon path={mdiArrowTopRight} size={0.7} style={{ flexShrink: 0 }} />
              </Link>
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography color="textSecondary" variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {comment}
            </Typography>
          </Box>

          <TicketUploadStatusRow upload={upload} canViewStatusHistory={canViewStatusHistory} />

          <TicketUploadReviewRow
            label="Validation"
            scope="validation"
            reviews={upload.reviews.validation}
            onCreateReview={setCreateReviewScope}
            onOpenReview={(reviewId) => onOpenReview(upload, reviewId)}
          />
          <TicketUploadReviewRow
            label="Security Review"
            scope="security"
            reviews={upload.reviews.security}
            onCreateReview={setCreateReviewScope}
            onOpenReview={(reviewId) => onOpenReview(upload, reviewId)}
          />

          <TicketUploadDecisionRow
            upload={upload}
            onAccept={onAccept}
            onReject={onReject}
            onResetDecision={onResetDecision}
          />
        </Box>
      </TicketTimelineItem>

      {createReviewScope && (
        <CreateReviewDialog
          scope={createReviewScope}
          onCancel={() => setCreateReviewScope(null)}
          onSave={handleCreateReview}
        />
      )}
    </>
  );
};
