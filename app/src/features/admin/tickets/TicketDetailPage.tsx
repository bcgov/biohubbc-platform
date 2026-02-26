import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EditTicketDialog } from './components/dialog/EditTicketDialog';
import { TicketTeamDialog } from './components/dialog/TicketTeamDialog';
import { TicketCommentSection } from './detail/TicketCommentSection';
import { TicketFooter } from './detail/TicketFooter';
import { TicketHeader } from './detail/TicketHeader';
import { TicketSidebar } from './detail/TicketSidebar';
import { TicketTimeline } from './detail/TicketTimeline';
import { useTicketCommentSaving } from './hooks/useTicketCommentSaving';
import { useTicketEditDialog } from './hooks/useTicketEditDialog';
import { useTicketError } from './hooks/useTicketError';
import { useTicketStatus } from './hooks/useTicketStatus';
import { useTicketTeamDialog } from './hooks/useTicketTeamDialog';
import { useApi } from 'hooks/useApi';

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

  const { error, setError } = useTicketError();
  const { isSavingComment, setIsSavingComment } = useTicketCommentSaving();
  const { isTeamDialogOpen, openTeamDialog, closeTeamDialog } = useTicketTeamDialog();

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

  const { isSavingStatus, handleUpdateStatus } = useTicketStatus({
    ticketId,
    onRefreshTicket: refreshTicketData,
    onError: setError
  });
  const { isSavingTicket, editTicketError, isEditDialogOpen, openEditDialog, closeEditDialog, handleEditTicket } =
    useTicketEditDialog({
      ticketId,
      onRefreshTicket: refreshTicketData
    });

  if (!ticketId) {
    return null;
  }

  return (
    <>
      <TicketHeader ticket={ticket} onEdit={openEditDialog} />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <LoadingGuard
          isLoading={ticketLoader.isLoading}
          hasNoData={!ticket}
          hasNoDataFallback={<Alert severity="info">Ticket not found.</Alert>}>
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
                <TicketCommentSection
                  ticketId={ticketId}
                  isTicketOpen={ticket?.status === 'open'}
                  isSavingStatus={isSavingStatus}
                  onRefreshTicket={refreshTicketData}
                  onError={setError}
                  onSavingChange={setIsSavingComment}
                />
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
                  onAddTeam={openTeamDialog}
                />
              </Box>
            </Stack>
          </Paper>
        </LoadingGuard>
      </Container>

      {isEditDialogOpen && ticket ? (
        <EditTicketDialog
          open={isEditDialogOpen}
          ticket={ticket}
          isSaving={isSavingTicket}
          error={editTicketError}
          onClose={closeEditDialog}
          onSave={handleEditTicket}
        />
      ) : null}

      <TicketTeamDialog open={isTeamDialogOpen} onClose={closeTeamDialog} />
    </>
  );
};
