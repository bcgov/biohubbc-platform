import { useTicketComment } from 'features/admin/tickets/hooks/useTicketComment';
import { TicketSkeleton } from 'features/admin/tickets/detail/skeleton/TicketSkeleton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useTicketContext } from 'hooks/useContext';
import { PortalTicketDetailPageContent } from './detail/content/PortalTicketDetailPageContent';

/**
 * Portal ticket detail page for viewing timeline activity.
 *
 * @return {*}
 */
export const PortalTicketDetailPage = () => {
  const { ticketDataLoader } = useTicketContext();
  const { comment, setComment, isSavingComment, handleAddComment } = useTicketComment();
  const ticket = ticketDataLoader.data;

  return (
    <LoadingGuard
      isLoading={ticketDataLoader.isLoading || !ticket}
      isLoadingFallback={<TicketSkeleton />}
      isLoadingFallbackDelay={300}>
      {ticket ? (
        <PortalTicketDetailPageContent
          ticket={ticket}
          isLoading={ticketDataLoader.isLoading}
          comment={comment}
          setComment={setComment}
          isSavingComment={isSavingComment}
          onAddComment={handleAddComment}
        />
      ) : null}
    </LoadingGuard>
  );
};
