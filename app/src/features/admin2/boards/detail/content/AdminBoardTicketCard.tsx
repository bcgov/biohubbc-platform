import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TagChip } from 'components/tags/TagChip';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface IAdminBoardTicketCardProps {
  ticket: ITicketWithTags;
}

/**
 * One ticket in a board lane: its slug, priority, subject and tags, linking to the ticket's administrative page.
 *
 * @param {IAdminBoardTicketCardProps} props The ticket.
 * @returns {JSX.Element} The ticket card.
 */
export const AdminBoardTicketCard = (props: IAdminBoardTicketCardProps) => {
  const { ticket } = props;

  return (
    <Card variant="outlined" data-testid={`board-ticket-${ticket.ticket_id}`}>
      <CardActionArea component={RouterLink} to={`/admin/tickets/${ticket.ticket_id}`} sx={{ p: 1.5 }}>
        <Stack gap={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography variant="body2" color="text.secondary">
              #{ticket.ticket_slug}
            </Typography>
            <Chip label={ticket.priority} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
          </Stack>
          <Typography variant="body2" fontWeight={700}>
            {ticket.subject}
          </Typography>
          {ticket.tags.length ? (
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {ticket.tags.map((tag) => (
                <TagChip key={tag.tag_id} tag={tag} />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </CardActionArea>
    </Card>
  );
};
