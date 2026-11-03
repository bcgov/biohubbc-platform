import { mdiDotsVertical, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TagChip } from 'components/tags/TagChip';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';

interface IBoardTicketCardProps {
  ticket: ITicketWithTags;
  /** Opens the ticket's page. */
  onClick: (ticketId: string) => void;
  /** Starts dragging the card to a lane. */
  onDragStart: () => void;
  onDragEnd: () => void;
  /** Takes the ticket off the board. */
  onRemove: (ticket: ITicketWithTags) => void;
}

/**
 * A ticket on a board as a kanban card: its subject with its number beside it, then its priority and tags. Clicking the
 * card opens the ticket, the card can be dragged to a lane, and its menu takes the ticket off the board.
 *
 * @param {IBoardTicketCardProps} props The ticket, and its click, drag and remove handlers.
 * @returns {JSX.Element} The ticket card.
 */
export const BoardTicketCard = (props: IBoardTicketCardProps) => {
  const { ticket, onClick, onDragStart, onDragEnd, onRemove } = props;

  return (
    <Card
      variant="outlined"
      data-testid="board-ticket-card"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      sx={{ cursor: 'grab', position: 'relative' }}>
      <CardActionArea onClick={() => onClick(ticket.ticket_id)} sx={{ p: 1.5, pr: 5 }}>
        <Stack gap={1}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="baseline">
            <Typography
              variant="body2"
              fontWeight={700}
              title={ticket.subject}
              sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {ticket.subject}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              #{ticket.ticket_slug}
            </Typography>
          </Stack>
          <Typography variant="body2" color="textSecondary" sx={{ textTransform: 'capitalize' }}>
            {ticket.priority}
          </Typography>
          {ticket.tags.length > 0 && (
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {ticket.tags.map((tag) => (
                <TagChip key={tag.tag_id} tag={tag} />
              ))}
            </Stack>
          )}
        </Stack>
      </CardActionArea>
      <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
        <CustomMenuIconButton
          buttonTitle="Actions"
          buttonIcon={<Icon path={mdiDotsVertical} size={0.875} />}
          menuItems={[
            {
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Remove from board',
              menuOnClick: () => onRemove(ticket)
            }
          ]}
        />
      </Box>
    </Card>
  );
};
