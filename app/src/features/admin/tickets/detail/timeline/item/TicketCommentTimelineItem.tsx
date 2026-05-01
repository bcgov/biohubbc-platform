import { TicketMarkdownContent } from 'features/tickets/markdown/TicketMarkdownContent';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { TicketTimelineItem } from './TicketTimelineItem';

interface ITicketCommentTimelineItemProps {
  author: string;
  comment: string;
  artifacts: ITicketArtifact[];
  dateLabel: string;
  onArtifactLinkClick?: (artifact: ITicketArtifact) => Promise<void> | void;
}

/**
 * Ticket timeline event card for comments.
 *
 * @param {ITicketCommentTimelineItemProps} props
 * @return {*}
 */
export const TicketCommentTimelineItem = (props: ITicketCommentTimelineItemProps) => {
  const { author, comment, artifacts, dateLabel, onArtifactLinkClick } = props;

  return (
    <TicketTimelineItem subtitle={author} dateLabel={dateLabel}>
      <TicketMarkdownContent content={comment} artifacts={artifacts} onArtifactLinkClick={onArtifactLinkClick} />
    </TicketTimelineItem>
  );
};
