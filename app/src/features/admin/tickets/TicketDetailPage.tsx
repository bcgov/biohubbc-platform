import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { ITicketWithHistory, IUpdateTicketRequest, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EditTicketDialog } from './components/dialog/EditTicketDialog';
import { TicketTeamDialog } from './components/dialog/TicketTeamDialog';
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
  const { ticketId } = useParams<{ ticketId: string }>();

  const ticketLoader = useDataLoader((ticketId: string) => api.tickets.getTicket(ticketId));
  const teamLoader = useDataLoader((teamId: string) => api.teams.getTeam(teamId));

  const [comment, setComment] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [editTicketError, setEditTicketError] = useState<string | undefined>();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      return;
    }

    ticketLoader.load(ticketId);
  }, [ticketId, ticketLoader]);

  const ticket: ITicketWithHistory | undefined = ticketLoader.data;
  const ticketTeam: ITeamWithMembers | undefined = teamLoader.data;

  useEffect(() => {
    if (!ticket?.team_id) {
      return;
    }

    teamLoader.load(ticket.team_id);
  }, [ticket?.team_id, teamLoader]);

  const refreshTicketData = async () => {
    if (!ticketId) {
      return;
    }

    await ticketLoader.refresh(ticketId);
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!ticket || !ticketId) {
      return;
    }

    try {
      setIsSavingStatus(true);
      setError(undefined);

      await api.tickets.updateTicketStatus(ticketId, status);

      await refreshTicketData();
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      setError(apiError.message || 'Failed to update status.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleEditTicket = async (payload: IUpdateTicketRequest) => {
    if (!ticketId) {
      return;
    }

    try {
      setIsSavingTicket(true);
      setEditTicketError(undefined);

      await api.tickets.updateTicket(ticketId, payload);
      await refreshTicketData();
      setIsEditDialogOpen(false);
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      setEditTicketError(apiError.message || 'Failed to update ticket.');
    } finally {
      setIsSavingTicket(false);
    }
  };

  const handleAddComment = async () => {
    if (!ticketId || !comment.trim()) {
      return;
    }

    try {
      setIsSavingComment(true);
      setError(undefined);

      await api.tickets.createTicketComment(ticketId, { comment: comment.trim() });
      setComment('');
      await refreshTicketData();
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      setError(apiError.message || 'Failed to add comment.');
    } finally {
      setIsSavingComment(false);
    }
  };

  if (!ticketId) {
    return null;
  }

  return (
    <>
      <TicketHeader ticket={ticket} onEdit={() => setIsEditDialogOpen(true)} />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={1} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              alignItems: 'flex-start'
            }}>
            <Stack spacing={4} sx={{ flex: '1 1 0', minWidth: { xs: '100%', md: 560 } }}>
              {error && <Alert severity="error">{error}</Alert>}

              <TicketTimeline
                history={[...(ticket?.status_log ?? []), ...(ticket?.comment_log ?? [])].sort(
                  (a, b) => new Date(a.create_date).getTime() - new Date(b.create_date).getTime()
                )}
                isLoading={ticketLoader.isLoading}
              />
              {ticket?.status === 'open' ? (
                <TicketComment
                  comment={comment}
                  setComment={setComment}
                  isSaving={isSavingComment || isSavingStatus}
                  onAddComment={handleAddComment}
                />
              ) : null}
              <TicketFooter
                isSavingStatus={isSavingStatus}
                isSavingComment={isSavingComment}
                status={ticket?.status}
                onUpdateStatus={handleUpdateStatus}
              />
            </Stack>

            <Box sx={{ width: { xs: '100%', sm: 280 }, flex: { xs: '1 1 100%', sm: '0 0 280px' } }}>
              <TicketSidebar
                isLoading={teamLoader.isLoading}
                team={ticketTeam}
                onAddTeam={() => setIsTeamDialogOpen(true)}
              />
            </Box>
          </Stack>
        </Paper>
      </Container>

      {isEditDialogOpen && ticket ? (
        <EditTicketDialog
          open={isEditDialogOpen}
          ticket={ticket}
          isSaving={isSavingTicket}
          error={editTicketError}
          onClose={() => {
            setEditTicketError(undefined);
            setIsEditDialogOpen(false);
          }}
          onSave={handleEditTicket}
        />
      ) : null}

      <TicketTeamDialog open={isTeamDialogOpen} onClose={() => setIsTeamDialogOpen(false)} />
    </>
  );
};
