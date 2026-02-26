import Typography from '@mui/material/Typography';
import { TicketTimelineEvent } from './TicketTimelineEvent';

interface ITicketCommentTimelineEventProps {
  author: string;
  comment: string;
  dateLabel: string;
}

/**
 * Ticket timeline event card for comments.
 *
 * @param {ITicketCommentTimelineEventProps} props
 * @return {*}
 */
export const TicketCommentTimelineEvent = (props: ITicketCommentTimelineEventProps) => {
  const { author, comment, dateLabel } = props;

  return (
    <TicketTimelineEvent title="Comment" subtitle={author} dateLabel={dateLabel}>
      <Typography variant="body2">{comment}</Typography>
    </TicketTimelineEvent>
  );
};
