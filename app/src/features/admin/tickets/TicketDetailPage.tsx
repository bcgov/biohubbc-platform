import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { PageSection } from 'components/section/PageSection';
import { useTicketContext } from 'hooks/useContext';
import { useState } from 'react';
import { TicketComment } from './detail/comment/TicketComment';
import { TicketHeader } from './detail/header/TicketHeader';
import { TicketSidebar } from './detail/sidebar/TicketSidebar';
import { TicketSkeleton } from './detail/skeleton/TicketSkeleton';
import { TicketTimeline } from './detail/timeline/TicketTimeline';
import { useTicketComment } from './hooks/useTicketComment';
import { sortChronological } from './utils/sortChronological';

/**
 * Admin ticket detail page for viewing timeline activity and changing ticket status.
 *
 * @return {*}
 */
export const TicketDetailPage = () => {
  const { ticketDataLoader } = useTicketContext();

  const [isSavingComment, setIsSavingComment] = useState(false);
  const { comment, setComment, handleAddComment } = useTicketComment({
    onSavingChange: setIsSavingComment
  });
  const ticket = ticketDataLoader.data;

  return (
    <LoadingGuard
      isLoading={ticketDataLoader.isLoading && !ticket}
      isLoadingFallback={<TicketSkeleton />}
      isLoadingFallbackDelay={300}>
      <>
        {ticket ? <TicketHeader ticket={ticket} /> : null}

        <Container maxWidth="xl" sx={{ py: 4 }}>
          <PageSection id="ticket-detail-content" label="Ticket Details">
            <Stack
              sx={{
                p: { xs: 2, md: 3 },
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 7,
                alignItems: 'flex-start'
              }}>
              <Stack spacing={4} sx={{ flex: '1 1 0', minWidth: { xs: '100%', md: 560 } }}>
                <TicketTimeline
                  history={[...(ticket?.statuses ?? []), ...(ticket?.comments ?? [])].sort(sortChronological)}
                  isLoading={ticketDataLoader.isLoading}
                />
                {ticket?.status === 'open' ? (
                  <TicketComment
                    comment={comment}
                    setComment={setComment}
                    isSaving={isSavingComment}
                    onAddComment={handleAddComment}
                  />
                ) : null}
              </Stack>

              <Box sx={{ width: { xs: '100%', sm: 340 }, flex: { xs: '1 1 100%', sm: '0 0 340px' } }}>
                <TicketSidebar teamId={ticket?.team_id} references={ticket?.references} />
              </Box>
            </Stack>
          </PageSection>
        </Container>
      </>
    </LoadingGuard>
  );
};
