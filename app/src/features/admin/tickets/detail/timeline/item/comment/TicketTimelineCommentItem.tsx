import { mdiDotsVertical, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import { ContextMenuButton } from 'components/ContextMenuButton';
import { TicketMarkdownContent } from 'features/tickets/markdown/TicketMarkdownContent/components/TicketMarkdownContent';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { TicketTimelineItem } from '../layout/TicketTimelineItem';

interface ITicketTimelineCommentItemProps {
  ticketCommentId: string;
  author: string;
  comment: string;
  artifacts: ITicketArtifact[];
  dateLabel: string;
  onArtifactLinkClick?: (artifact: ITicketArtifact) => Promise<void> | void;
  onEdit?: (ticketCommentId: string) => Promise<void> | void;
  onDelete?: (ticketCommentId: string) => Promise<void> | void;
}

/**
 * Ticket timeline event card for comments.
 *
 * @param {ITicketTimelineCommentItemProps} props
 * @return {*}
 */
export const TicketTimelineCommentItem = (props: ITicketTimelineCommentItemProps) => {
  const { ticketCommentId, author, comment, artifacts, dateLabel, onArtifactLinkClick, onEdit, onDelete } = props;

  return (
    <TicketTimelineItem
      subtitle={author}
      dateLabel={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box component="span">{dateLabel}</Box>
          <ContextMenuButton
            buttonTitle={`ticket-comment-${ticketCommentId}-menu`}
            buttonIcon={<Icon path={mdiDotsVertical} size={0.75} />}
            itemGroups={[
              {
                groupId: 'comment-actions',
                items: [
                  {
                    label: 'Edit',
                    icon: <Icon path={mdiPencilOutline} size={0.7} />,
                    onClick: () => onEdit?.(ticketCommentId)
                  },
                  {
                    label: 'Delete',
                    icon: <Icon path={mdiTrashCanOutline} size={0.7} />,
                    onClick: () => onDelete?.(ticketCommentId)
                  }
                ]
              }
            ]}
          />
        </Box>
      }>
      <TicketMarkdownContent content={comment} artifacts={artifacts} onArtifactLinkClick={onArtifactLinkClick} />
    </TicketTimelineItem>
  );
};
