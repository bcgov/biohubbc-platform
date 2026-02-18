import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ITicket } from 'interfaces/useTicketsApi.interface';
import { TicketCard } from './card/TicketCard';

interface ITicketsListProps {
  tickets: ITicket[];
  isLoading: boolean;
  emptyTitle: string;
  emptyMessage: string;
  onTicketClick: (ticketId: string) => void;
}

/**
 * Presentational tickets list with loading and empty states.
 *
 * @param {ITicketsListProps} props
 * @return {*}
 */
export const TicketsList = (props: ITicketsListProps) => {
  const { tickets, isLoading, emptyTitle, emptyMessage, onTicketClick } = props;

  if (isLoading) {
    return (
      <Stack gap={2}>
        <Skeleton variant="rounded" height={84} />
        <Skeleton variant="rounded" height={84} />
        <Skeleton variant="rounded" height={84} />
      </Stack>
    );
  }

  if (!tickets.length) {
    return (
      <Stack alignItems="center" justifyContent="center" p={3} component={Paper} elevation={0} minHeight={168}>
        <Typography data-testid="tickets-empty-title" component="h2" variant="h4" fontWeight={700} sx={{ mb: 1 }}>
          {emptyTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Stack gap={2}>
        {tickets.map((ticket) => (
          <TicketCard key={ticket.ticket_id} ticket={ticket} onClick={onTicketClick} />
        ))}
      </Stack>
    </Box>
  );
};
