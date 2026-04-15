import { useTicketComment } from 'features/admin/tickets/hooks/useTicketComment';
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

  return (
    <PortalTicketDetailPageContent
      ticket={ticketDataLoader.data}
      isLoading={ticketDataLoader.isLoading}
      comment={comment}
      setComment={setComment}
      isSavingComment={isSavingComment}
      onAddComment={handleAddComment}
    />
  );
};
