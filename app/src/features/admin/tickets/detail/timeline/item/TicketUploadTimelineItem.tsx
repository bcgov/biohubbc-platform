import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SubmissionUploadReviewScope } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
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
  const { upload, dateLabel, isCreatingReview, onCreateReview, onOpenReview, onAccept, onReject, onResetDecision } =
    props;
  const bodyText =
    upload.submission_comment ||
    upload.submission_description ||
    `Submission upload ${upload.submission_upload_id.slice(0, 8)}`;
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
          <Box sx={{ px: 2, py: 2.5 }}>
            <Typography variant="body2">{bodyText}</Typography>
          </Box>

          <TicketUploadStatusRow upload={upload} />

          <TicketUploadReviewRow
            label="Validation"
            scope="validation"
            reviews={upload.reviews.validation}
            isCreatingReview={isCreatingReview('validation')}
            onCreateReview={setCreateReviewScope}
            onOpenReview={(scope, reviewId) => onOpenReview(upload, scope, reviewId)}
          />
          <TicketUploadReviewRow
            label="Security Review"
            scope="security"
            reviews={upload.reviews.security}
            isCreatingReview={isCreatingReview('security')}
            onCreateReview={setCreateReviewScope}
            onOpenReview={(scope, reviewId) => onOpenReview(upload, scope, reviewId)}
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
          isLoading={isCreatingReview(createReviewScope)}
          onCancel={() => setCreateReviewScope(null)}
          onSave={handleCreateReview}
        />
      )}
    </>
  );
};
