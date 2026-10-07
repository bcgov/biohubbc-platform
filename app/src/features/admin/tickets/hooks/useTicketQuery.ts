import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useTicketContext } from 'hooks/useContext';

/**
 * Loads the route's ticket detail through the endpoints its context scope allows.
 *
 * Every component on a ticket page reads the ticket through this query, so they share one request and one
 * cached copy; changes are written to that copy with `setQueryData` on the context's `ticketQueryKey`.
 *
 * @returns The ticket detail query.
 */
export const useTicketQuery = () => {
  const api = useApi();
  const { ticketId, ticketScope, ticketQueryKey } = useTicketContext();

  return useQuery({
    queryKey: ticketQueryKey,
    queryFn: ({ signal }) =>
      ticketScope === 'admin'
        ? api.tickets.getTicketForAdmin(ticketId, { signal })
        : api.tickets.getTicketForUser(ticketId, { signal })
  });
};
