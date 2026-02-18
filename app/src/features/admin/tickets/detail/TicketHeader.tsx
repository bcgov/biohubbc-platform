import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface ITicketHeaderProps {
  ticket?: ITicketWithHistory;
}

/**
 * Renders the ticket header with breadcrumb, identifier, status, and description.
 *
 * @param {ITicketHeaderProps} props
 * @return {*}
 */
export const TicketHeader = (props: ITicketHeaderProps) => {
  const { ticket } = props;

  return (
    <Paper square elevation={0}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Breadcrumbs aria-label="ticket breadcrumb" sx={{ mb: 1.5 }}>
          <Link component={RouterLink} to="/admin/tickets" underline="hover" color="inherit">
            Tickets
          </Link>
          <Typography color="text.primary">{ticket ? `Ticket #${ticket.ticket_short_id}` : 'Ticket'}</Typography>
        </Breadcrumbs>

        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h1">{ticket ? `Ticket #${ticket.ticket_short_id}` : 'Ticket'}</Typography>
          {ticket?.status && (
            <Chip
              label={ticket.status === 'OPEN' ? 'Open' : 'Closed'}
              color="primary"
              sx={{ height: 40, px: 1.25, borderRadius: 5, '& .MuiChip-label': { fontSize: '1.5rem', fontWeight: 700 } }}
            />
          )}
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {ticket?.description || 'No description has been added to this ticket.'}
        </Typography>
      </Container>
    </Paper>
  );
};
