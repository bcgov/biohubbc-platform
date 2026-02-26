import Icon from '@mdi/react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { getPriorityIcon } from '../../utils/priorityIcon';

interface ITicketCardProps {
  ticket: ITicket;
  onClick: (ticketId: string) => void;
}

/**
 * Card row used to render a single ticket in the admin tickets list.
 *
 * @param {ITicketCardProps} props
 * @return {*}
 */
export const TicketCard = (props: ITicketCardProps) => {
  const { ticket, onClick } = props;
  const theme = useTheme();
  const priorityIcon = getPriorityIcon(ticket.priority, theme.palette);

  return (
    <Card elevation={0}>
      <CardActionArea onClick={() => onClick(ticket.ticket_id)} data-testid={`ticket-card-${ticket.ticket_id}`}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Stack gap={0.5}>
              <Typography variant="h4" component="h3">
                {ticket.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {ticket.description || 'No description provided.'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ticket #{ticket.ticket_slug} • Team: {ticket.team_id}
              </Typography>
            </Stack>
            <Stack direction="row" gap={1} alignItems="center">
              <Tooltip title={ticket.priority}>
                <Icon path={priorityIcon.path} size={1} color={priorityIcon.color} />
              </Tooltip>
              <Chip
                label={ticket.status === 'open' ? 'Open' : 'Closed'}
                size="small"
                color={ticket.status === 'open' ? 'primary' : 'default'}
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
