import { skipToken, useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useTicketContext } from 'hooks/useContext';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';

/**
 * Loads the route ticket's tags and tag history. Tags are administrative only, so the query never runs for a ticket
 * read through the portal's (user) scope.
 *
 * The ticket's sidebar and timeline share this one cached copy; tag changes are written to it with `setQueryData`.
 *
 * @returns The ticket tags query.
 */
export const useTicketTagsQuery = () => {
  const api = useApi();
  const { ticketId, ticketScope } = useTicketContext();

  return useQuery({
    queryKey: ticketQueryKeys.tags(ticketId),
    // Presentation only: the server enforces admin-only access to ticket tags.
    queryFn: ticketScope === 'admin' ? ({ signal }) => api.tags.getTicketTags(ticketId, { signal }) : skipToken
  });
};
