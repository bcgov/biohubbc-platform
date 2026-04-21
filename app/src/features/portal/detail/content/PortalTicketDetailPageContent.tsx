import { Box, Container, Stack } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { PageSection } from 'components/section/PageSection';
import { TicketComment } from 'features/admin/tickets/detail/comment/TicketComment';
import { TicketSkeleton } from 'features/admin/tickets/detail/skeleton/TicketSkeleton';
import { TicketTimeline } from 'features/admin/tickets/detail/timeline/TicketTimeline';
import { PortalTicketHeader } from '../header/PortalTicketHeader';
import { PortalTicketSidebar } from '../sidebar/PortalTicketSidebar';
import { IPortalTicketDetailPageContentProps } from './PortalTicketDetailPageContent.interface';

/**
 * Render portal ticket detail content including timeline, comment editor and sidebar.
 *
 * @param {IPortalTicketDetailPageContentProps} props
 * @returns {JSX.Element}
 */
export const PortalTicketDetailPageContent = (props: IPortalTicketDetailPageContentProps) => {
  const { ticket, isLoading, comment, setComment, isSavingComment, onAddComment } = props;

  return (
    <LoadingGuard isLoading={isLoading && !ticket} isLoadingFallback={<TicketSkeleton />} isLoadingFallbackDelay={300}>
      <>
        {ticket ? <PortalTicketHeader ticket={ticket} /> : null}

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
                <TicketTimeline ticket={ticket} isLoading={isLoading} />
                {ticket?.status === 'open' && (
                  <TicketComment
                    comment={comment}
                    setComment={setComment}
                    isSaving={isSavingComment}
                    onAddComment={onAddComment}
                  />
                )}
              </Stack>

              <Box sx={{ width: { xs: '100%', sm: 340 }, flex: { xs: '1 1 100%', sm: '0 0 340px' } }}>
                <PortalTicketSidebar teamId={ticket?.team_id} assignees={ticket?.assignees} />
              </Box>
            </Stack>
          </PageSection>
        </Container>
      </>
    </LoadingGuard>
  );
};
