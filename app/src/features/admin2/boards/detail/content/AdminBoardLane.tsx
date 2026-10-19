import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ITicketWithTags } from 'interfaces/useTicketsApi.interface';
import { AdminBoardTicketCard } from './AdminBoardTicketCard';

interface IAdminBoardLaneProps {
  id: string;
  name: string;
  /** The lane's color, or null for the neutral lane color. */
  color: string | null;
  tickets: ITicketWithTags[];
}

/**
 * One column of a board: the lane's name, color and ticket count above its ticket cards.
 *
 * @param {IAdminBoardLaneProps} props The lane and its tickets.
 * @returns {JSX.Element} The lane column.
 */
export const AdminBoardLane = (props: IAdminBoardLaneProps) => {
  const { id, name, color, tickets } = props;

  return (
    <Paper
      variant="outlined"
      data-testid={`board-lane-${id}`}
      aria-label={name}
      component="section"
      sx={{
        flex: '0 0 300px',
        width: 300,
        bgcolor: 'grey.50',
        borderTop: 4,
        borderTopColor: color ?? 'grey.400',
        display: 'flex',
        flexDirection: 'column'
      }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle2" component="h3" fontWeight={700} noWrap title={name}>
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tickets.length}
        </Typography>
      </Stack>
      <Stack gap={1} sx={{ px: 1, pb: 1 }}>
        {tickets.map((ticket) => (
          <AdminBoardTicketCard key={ticket.ticket_id} ticket={ticket} />
        ))}
        {tickets.length ? null : (
          <Box sx={{ px: 1, pb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No tickets
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
