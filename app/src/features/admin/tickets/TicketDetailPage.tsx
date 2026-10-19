import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { useState } from 'react';
import { TicketArtifacts } from './detail/artifacts/TicketArtifacts';
import { TicketComment } from './detail/comment/TicketComment';
import { TicketDetailTab, TicketHeader } from './detail/header/TicketHeader';
import { TicketSidebar } from './detail/sidebar/TicketSidebar';
import { TicketSkeleton } from './detail/skeleton/TicketSkeleton';
import { TicketTimeline } from './detail/timeline/TicketTimeline';
import { useTicketComment } from './hooks/useTicketComment';
import { useTicketQuery } from './hooks/useTicketQuery';
import { useTicketTagsQuery } from './hooks/useTicketTagsQuery';

/**
 * Admin ticket detail page for viewing timeline activity and changing ticket status. The ticket's tag history, which
 * only administrators see, is loaded here and merged into the shared timeline.
 *
 * @returns {JSX.Element}
 */
export const TicketDetailPage = () => {
  const ticketQuery = useTicketQuery();
  const ticketTagsQuery = useTicketTagsQuery();
  const { comment, setComment, isSavingComment, isUploadingAttachment, handleAddComment, handleUploadAttachment } =
    useTicketComment();
  const ticket = ticketQuery.data;
  const isLoading = ticketQuery.isFetching;
  const [activeTab, setActiveTab] = useState<TicketDetailTab>('timeline');

  return (
    <>
      <QueryErrorDialog error={ticketQuery.error} label="ticket" />
      <LoadingGuard
        isLoading={isLoading && !ticket}
        isLoadingFallback={<TicketSkeleton />}
        isLoadingFallbackDelay={300}>
        {ticket ? (
          <TicketHeader ticket={ticket} activeTab={activeTab} onTabChange={setActiveTab}>
            <ComponentSwitch<TicketDetailTab>
              switch={activeTab}
              components={{
                timeline: (
                  <PageSection id="ticket-detail-content" label="Ticket Details">
                    <Stack
                      sx={{
                        p: { xs: 2, md: 3 },
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        gap: 7,
                        alignItems: 'flex-start'
                      }}>
                      <Stack spacing={4} sx={{ flex: '1 1 0', minWidth: { xs: '100%', sm: 0 } }}>
                        <TicketTimeline ticket={ticket} tagEvents={ticketTagsQuery.data?.events} />
                        {ticket.status === 'open' && (
                          <TicketComment
                            comment={comment}
                            setComment={setComment}
                            isSaving={isSavingComment}
                            isUploadingAttachment={isUploadingAttachment}
                            onAddComment={handleAddComment}
                            onUploadAttachment={handleUploadAttachment}
                          />
                        )}
                      </Stack>

                      <Box sx={{ width: { xs: '100%', sm: 238 }, flex: { xs: '1 1 100%', sm: '0 0 238px' } }}>
                        <TicketSidebar />
                      </Box>
                    </Stack>
                  </PageSection>
                ),
                artifacts: <TicketArtifacts />
              }}
            />
          </TicketHeader>
        ) : null}
      </LoadingGuard>
    </>
  );
};
