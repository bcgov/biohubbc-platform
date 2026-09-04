import { mdiPlus } from '@mdi/js';
import Button from '@mui/material/Button';
import { DropdownButton } from 'components/DropdownButton';
import { ITicketUploadReviewRowProps } from '../TicketUploadTimelineItem.interface';
import { TicketUploadReviewRowLayout } from './TicketUploadReviewRowLayout';

/**
 * Starts new scoped reviews and opens any existing review for the upload timeline card.
 *
 * @param {ITicketUploadReviewRowProps} props - Component props.
 * @returns {JSX.Element} Submission upload review action row.
 */
export const TicketUploadReviewRow = (props: ITicketUploadReviewRowProps) => {
  const { label, scope, reviews, isCreatingReview, onCreateReview, onOpenReview } = props;
  const isCompleted = reviews.every((review) => review.status === 'completed');

  return (
    <TicketUploadReviewRowLayout label={label}>
      {reviews.length ? (
        <DropdownButton
          value={null}
          itemGroups={[
            {
              groupId: `${scope}-new-review`,
              items: [
                {
                  value: `${scope}-new-review`,
                  label: 'New Review',
                  iconPath: mdiPlus,
                  sx: { bgcolor: 'grey.50' },
                  onClick: () => onCreateReview(scope)
                }
              ]
            },
            {
              groupId: `${scope}-reviews`,
              items: reviews.map((review) => ({
                value: review.submission_upload_review_id,
                label: review.name
              }))
            }
          ]}
          size="small"
          variant="contained"
          color={isCompleted ? 'success' : 'primary'}
          loading={isCreatingReview}
          onSelect={(reviewId) => onOpenReview(scope, reviewId)}>
          {isCompleted ? 'Completed' : 'Continue'}
        </DropdownButton>
      ) : (
        <Button
          size="small"
          variant="contained"
          color="primary"
          loading={isCreatingReview}
          onClick={() => onCreateReview(scope)}>
          Review
        </Button>
      )}
    </TicketUploadReviewRowLayout>
  );
};
