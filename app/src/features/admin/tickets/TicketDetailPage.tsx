import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ITicketWithHistory, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { TicketStatusTimeline } from './components/TicketStatusTimeline';

/**
 * Admin ticket detail page for viewing timeline activity and changing ticket status.
 *
 * @return {*}
 */
export const TicketDetailPage = () => {
  const api = useApi();
  const { ticketId } = useParams<{ ticketId: string }>();

  const ticketLoader = useDataLoader((ticketId: string) => api.tickets.getTicket(ticketId));

  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!ticketId) {
      return;
    }

    ticketLoader.load(ticketId);
  }, [ticketId, ticketLoader]);

  const ticket: ITicketWithHistory | undefined = ticketLoader.data;

  const refreshTicketData = async () => {
    if (!ticketId) {
      return;
    }

    await ticketLoader.refresh(ticketId);
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!ticket) {
      return;
    }

    try {
      setIsSaving(true);
      setError(undefined);

      await api.tickets.updateTicketStatus(ticket.ticket_id, status);

      await refreshTicketData();
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      setError(apiError.message || 'Failed to update status.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!ticketId) {
    return null;
  }

  return (
    <>
      <Paper square elevation={0}>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Breadcrumbs aria-label="ticket breadcrumb" sx={{ mb: 1.5 }}>
            <Link component={RouterLink} to="/admin/tickets" underline="hover" color="inherit">
              Tickets
            </Link>
            <Typography color="text.primary">{ticket ? `Ticket #${ticket.ticket_number}` : 'Ticket'}</Typography>
          </Breadcrumbs>

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h1">{ticket ? `Ticket #${ticket.ticket_number}` : 'Ticket'}</Typography>
            {ticket?.status && (
              <Chip
                label={ticket.status === 'OPEN' ? 'Open' : 'Closed'}
                color="primary"
                sx={{ height: 40, px: 1.25, borderRadius: 5, '& .MuiChip-label': { fontSize: '1.5rem', fontWeight: 700 } }}
              />
            )}
          </Stack>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            {ticket?.description || 'No description has been added to this ticket.'}
          </Typography>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={4}>
          {error && <Alert severity="error">{error}</Alert>}

          <TicketStatusTimeline history={ticket?.history ?? []} isLoading={ticketLoader.isLoading} />

          <Paper variant="outlined">
            <Box sx={{ px: 3, py: 2 }}>
              <Typography variant="h3" component="h3">
                Comment
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ p: 3 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                placeholder="Type your comment..."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </Box>
          </Paper>

          <Stack direction="row" justifyContent="flex-end" spacing={2} alignItems="center">
            {ticket?.status === 'OPEN' ? (
              <Button
                variant="contained"
                onClick={() => handleUpdateStatus('CLOSED')}
                disabled={isSaving}
                data-testid="close-ticket-button">
                Close Ticket
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => handleUpdateStatus('OPEN')}
                disabled={isSaving}
                data-testid="open-ticket-button">
                Reopen Ticket
              </Button>
            )}
            <Button variant="text" disabled={!comment.trim()}>
              Comment
            </Button>
          </Stack>
        </Stack>
      </Container>
    </>
  );
};
