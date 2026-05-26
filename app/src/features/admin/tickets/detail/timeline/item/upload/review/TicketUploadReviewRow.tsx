import { ITicketUploadReviewRowProps } from '../TicketUploadTimelineItem.interface';
import { TicketUploadReviewDropdown } from './TicketUploadReviewDropdown';
import { TicketUploadReviewRowLayout } from './TicketUploadReviewRowLayout';

/**
 * Displays and updates one scoped human review task on the upload timeline card.
 *
 * @param {ITicketUploadReviewRowProps} props
 * @return {*}
 */
export const TicketUploadReviewRow = (props: ITicketUploadReviewRowProps) => {
  const { label, upload, review, onUpdateReview } = props;

  return (
    <TicketUploadReviewRowLayout label={label}>
      <TicketUploadReviewDropdown
        value={review.status}
        onPending={() => onUpdateReview(upload, review, 'pending')}
        onRequested={() => onUpdateReview(upload, review, 'requested')}
        onInProgress={() => onUpdateReview(upload, review, 'in_progress')}
        onCompleted={() => onUpdateReview(upload, review, 'completed')}
        onBlocked={() => onUpdateReview(upload, review, 'blocked')}
        onSkipped={() => onUpdateReview(upload, review, 'skipped')}
        onCancelled={() => onUpdateReview(upload, review, 'cancelled')}
      />
    </TicketUploadReviewRowLayout>
  );
};
