import { useTicketComment } from 'features/admin/tickets/hooks/useTicketComment';
import { useTicketQuery } from 'features/admin/tickets/hooks/useTicketQuery';
import { TicketSkeleton } from 'features/admin/tickets/detail/skeleton/TicketSkeleton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { PortalTicketDetailPageContent } from './detail/content/PortalTicketDetailPageContent';

/**
 * Portal ticket detail page for viewing timeline activity.
 *
 * @return {*}
 */
export const PortalTicketDetailPage = () => {
  const ticketQuery = useTicketQuery();
  const { comment, setComment, isSavingComment, isUploadingAttachment, handleAddComment, handleUploadAttachment } =
    useTicketComment();
  const ticket = ticketQuery.data;

  return (
    <LoadingGuard
      isLoading={ticketQuery.isFetching || !ticket}
      isLoadingFallback={<TicketSkeleton />}
      isLoadingFallbackDelay={300}>
      {ticket ? (
        <PortalTicketDetailPageContent
          ticket={ticket}
          isLoading={ticketQuery.isFetching}
          comment={comment}
          setComment={setComment}
          isSavingComment={isSavingComment}
          isUploadingAttachment={isUploadingAttachment}
          onAddComment={handleAddComment}
          onUploadAttachment={handleUploadAttachment}
        />
      ) : null}
    </LoadingGuard>
  );
};
