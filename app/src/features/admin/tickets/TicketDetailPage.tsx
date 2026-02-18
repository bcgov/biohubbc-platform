import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ITicketWithHistory, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TicketComment } from './detail/TicketComment';
import { TicketFooter } from './detail/TicketFooter';
import { TicketHeader } from './detail/TicketHeader';
import { TicketSidebar } from './detail/TicketSidebar';
import { TicketTimeline } from './detail/TicketTimeline';

/**
 * Admin ticket detail page for viewing timeline activity and changing ticket status.
 *
 * @return {*}
 */
export const TicketDetailPage = () => {
  const api = useApi();
  const { ticketId: ticketRef } = useParams<{ ticketId: string }>();

  const ticketLoader = useDataLoader((ticketId: string) => api.tickets.getTicket(ticketId));
  const teamLoader = useDataLoader((teamId: string) => api.teams.getTeam(teamId));

  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!ticketRef) {
      return;
    }

    ticketLoader.load(ticketRef);
  }, [ticketRef, ticketLoader]);

  const ticket: ITicketWithHistory | undefined = ticketLoader.data;
  const ticketTeam: ITeamWithMembers | undefined = teamLoader.data;

  useEffect(() => {
    if (!ticket?.team_id) {
      return;
    }

    teamLoader.load(ticket.team_id);
  }, [ticket?.team_id, teamLoader]);

  const refreshTicketData = async () => {
    if (!ticketRef) {
      return;
    }

    await ticketLoader.refresh(ticketRef);
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!ticket || !ticketRef) {
      return;
    }

    try {
      setIsSaving(true);
      setError(undefined);

      await api.tickets.updateTicketStatus(ticketRef, status);

      await refreshTicketData();
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      setError(apiError.message || 'Failed to update status.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!ticketRef) {
    return null;
  }

  return (
    <>
      <TicketHeader ticket={ticket} />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 280px' },
            gap: 3,
            alignItems: 'start'
          }}>
          <Stack spacing={4}>
            {error && <Alert severity="error">{error}</Alert>}

            <TicketTimeline history={ticket?.history ?? []} isLoading={ticketLoader.isLoading} />
            <TicketComment comment={comment} setComment={setComment} />
            <TicketFooter
              comment={comment}
              isSaving={isSaving}
              status={ticket?.status}
              onUpdateStatus={handleUpdateStatus}
            />
          </Stack>

          <TicketSidebar isLoading={teamLoader.isLoading} team={ticketTeam} />
        </Box>
      </Container>
    </>
  );
};
