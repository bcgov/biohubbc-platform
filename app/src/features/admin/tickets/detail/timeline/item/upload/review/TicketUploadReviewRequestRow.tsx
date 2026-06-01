import Button from '@mui/material/Button';
import { ITicketUploadReviewRequestRowProps } from '../TicketUploadTimelineItem.interface';
import { TicketUploadReviewRowLayout } from './TicketUploadReviewRowLayout';

/**
 * Displays the action to request a scoped human review task.
 *
 * @param {ITicketUploadReviewRequestRowProps} props
 * @return {*}
 */
export const TicketUploadReviewRequestRow = (props: ITicketUploadReviewRequestRowProps) => {
  const { label, scope, upload, onRequestReview } = props;

  return (
    <TicketUploadReviewRowLayout label={label}>
      <Button
        size="small"
        variant="contained"
        sx={{
          bgcolor: 'grey.200',
          color: 'text.primary',
          '&:hover': {
            bgcolor: 'grey.300'
          }
        }}
        onClick={() => onRequestReview(upload, scope)}>
        Request Review
      </Button>
    </TicketUploadReviewRowLayout>
  );
};
