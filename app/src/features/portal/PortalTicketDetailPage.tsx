import { useTicketComment } from 'features/admin/tickets/hooks/useTicketComment';
import { useTicketQuery } from 'features/admin/tickets/hooks/useTicketQuery';
import { TicketSkeleton } from 'features/admin/tickets/detail/skeleton/TicketSkeleton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
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
    <>
      <QueryErrorDialog error={ticketQuery.error} label="ticket" />
      <LoadingGuard
        isLoading={ticketQuery.isFetching && !ticket}
        isLoadingFallback={<TicketSkeleton />}
        isLoadingFallbackDelay={300}>
        {ticket ? (
          <PortalTicketDetailPageContent
            ticket={ticket}
            comment={comment}
            setComment={setComment}
            isSavingComment={isSavingComment}
            isUploadingAttachment={isUploadingAttachment}
            onAddComment={handleAddComment}
            onUploadAttachment={handleUploadAttachment}
          />
        ) : null}
      </LoadingGuard>
    </>
  );
};
