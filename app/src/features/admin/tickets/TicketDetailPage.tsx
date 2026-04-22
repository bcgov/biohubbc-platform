import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { PageSection } from 'components/section/PageSection';
import { useTicketContext } from 'hooks/useContext';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { Dispatch, SetStateAction } from 'react';
import { TicketComment } from './detail/comment/TicketComment';
import { TicketHeader } from './detail/header/TicketHeader';
import { TicketSidebar } from './detail/sidebar/TicketSidebar';
import { TicketSkeleton } from './detail/skeleton/TicketSkeleton';
import { TicketTimeline } from './detail/timeline/TicketTimeline';
import { useTicketComment } from './hooks/useTicketComment';

export interface ITicketDetailPageContentProps {
  ticket: ITicketExtended | undefined;
  isLoading: boolean;
  comment: string;
  setComment: Dispatch<SetStateAction<string>>;
  isSavingComment: boolean;
  onAddComment: () => Promise<void>;
}

/**
 * Render ticket detail content including timeline, comment editor and sidebar.
 *
 * @param {ITicketDetailPageContentProps} props
 * @returns {JSX.Element}
 */
export const TicketDetailPageContent = (props: ITicketDetailPageContentProps) => {
  const { ticket, isLoading, comment, setComment, isSavingComment, onAddComment } = props;

  return (
    <LoadingGuard isLoading={isLoading && !ticket} isLoadingFallback={<TicketSkeleton />} isLoadingFallbackDelay={300}>
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
                <TicketSidebar
                  ticketId={ticket?.ticket_id}
                  teamId={ticket?.team_id}
                  ticketSystemUsers={ticket?.ticket_system_users}
                  references={ticket?.references}
                  dataRequests={ticket?.data_requests}
                />
              </Box>
            </Stack>
          </PageSection>
        </Container>
      </>
    </LoadingGuard>
  );
};

/**
 * Admin ticket detail page for viewing timeline activity and changing ticket status.
 *
 * @returns {JSX.Element}
 */
export const TicketDetailPage = () => {
  const { ticketDataLoader } = useTicketContext();
  const { comment, setComment, isSavingComment, handleAddComment } = useTicketComment();

  return (
    <TicketDetailPageContent
      ticket={ticketDataLoader.data}
      isLoading={ticketDataLoader.isLoading}
      comment={comment}
      setComment={setComment}
      isSavingComment={isSavingComment}
      onAddComment={handleAddComment}
    />
  );
};
