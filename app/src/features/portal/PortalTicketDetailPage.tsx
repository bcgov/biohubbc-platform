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
  const {
    comment,
    commentArtifacts,
    setComment,
    isSavingComment,
    isUploadingAttachment,
    handleAddComment,
    handleUploadAttachment
  } = useTicketComment();
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
          commentArtifacts={commentArtifacts}
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
