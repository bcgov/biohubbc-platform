import Typography from '@mui/material/Typography';
import { TicketTimelineItem } from './TicketTimelineItem';

interface ITicketCommentTimelineItemProps {
  author: string;
  comment: string;
  dateLabel: string;
}

/**
 * Ticket timeline event card for comments.
 *
 * @param {ITicketCommentTimelineItemProps} props
 * @return {*}
 */
export const TicketCommentTimelineItem = (props: ITicketCommentTimelineItemProps) => {
  const { author, comment, dateLabel } = props;

  return (
    <TicketTimelineItem subtitle={author} dateLabel={dateLabel}>
      <Typography variant="body2">{comment}</Typography>
    </TicketTimelineItem>
  );
};
