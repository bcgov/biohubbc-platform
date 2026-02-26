import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useTicketContext } from 'hooks/useContext';
import { TicketCommentSection } from './detail/TicketCommentSection';
import { TicketFooter } from './detail/TicketFooter';
import { TicketHeader } from './detail/TicketHeader';
import { TicketSidebar } from './detail/TicketSidebar';
import { TicketSkeleton } from './detail/TicketSkeleton';
import { TicketTimeline } from './detail/TicketTimeline';
import { useTicketCommentSaving } from './hooks/useTicketCommentSaving';
import { sortChronological } from './utils/sortChronological';

/**
 * Admin ticket detail page for viewing timeline activity and changing ticket status.
 *
 * @return {*}
 */
export const TicketDetailPage = () => {
  const { ticketDataLoader } = useTicketContext();

  const { isSavingComment, setIsSavingComment } = useTicketCommentSaving();
  const ticket = ticketDataLoader.data;

  return (
    <LoadingGuard
      isLoading={ticketDataLoader.isLoading && !ticket}
      isLoadingFallback={<TicketSkeleton />}
      isLoadingFallbackDelay={300}>
      <>
        <TicketHeader ticket={ticket} />

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
                <TicketTimeline
                  history={[...(ticket?.status_log ?? []), ...(ticket?.comment_log ?? [])].sort(sortChronological)}
                  isLoading={ticketDataLoader.isLoading}
                />
                <TicketCommentSection isTicketOpen={ticket?.status === 'open'} onSavingChange={setIsSavingComment} />
                <TicketFooter isSavingComment={isSavingComment} status={ticket?.status} />
              </Stack>

              <Box sx={{ width: { xs: '100%', sm: 280 }, flex: { xs: '1 1 100%', sm: '0 0 280px' } }}>
                <TicketSidebar teamId={ticket?.team_id} />
              </Box>
            </Stack>
          </Paper>
        </Container>
      </>
    </LoadingGuard>
  );
};
