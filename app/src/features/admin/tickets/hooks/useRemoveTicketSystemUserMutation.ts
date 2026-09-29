import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended, ITicketSystemUser } from 'interfaces/useTicketsApi.interface';
import { cancelQueryForOptimisticUpdate } from 'utils/query-client';

interface RemoveTicketSystemUserContext {
  ticketQueryKey: QueryKey;
  cancelledLoad: boolean;
  /** The removed row and where it stood, to put it back on failure. */
  removed: { row: ITicketSystemUser; index: number } | undefined;
}

/**
 * Removes an assigned user from the route's ticket, hiding the user before the request completes.
 *
 * A failure puts the user back where they stood, unless they have reappeared since, and reports the error.
 *
 * @returns The mutation; call `mutate` with the ticket system user id.
 */
export const useRemoveTicketSystemUserMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useMutation<void, Error, string, RemoveTicketSystemUserContext>({
    mutationFn: (ticketSystemUserId) => api.tickets.deleteTicketSystemUser(ticketId, ticketSystemUserId),
    onMutate: async (ticketSystemUserId) => {
      const cancelledLoad = await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey);
      const rows = queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.ticket_system_users ?? [];
      const index = rows.findIndex((row) => row.ticket_system_user_id === ticketSystemUserId);
      queryClient.setQueryData<ITicketExtended>(
        ticketQueryKey,
        (ticket) =>
          ticket && {
            ...ticket,
            ticket_system_users: ticket.ticket_system_users.filter(
              (row) => row.ticket_system_user_id !== ticketSystemUserId
            )
          }
      );
      return { ticketQueryKey, cancelledLoad, removed: index > -1 ? { row: rows[index], index } : undefined };
    },
    onError: (error, ticketSystemUserId, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      const removed = context?.removed;
      if (!removed) {
        return;
      }
      queryClient.setQueryData<ITicketExtended>(context.ticketQueryKey, (ticket) => {
        if (!ticket || ticket.ticket_system_users.some((row) => row.ticket_system_user_id === ticketSystemUserId)) {
          return ticket;
        }
        return {
          ...ticket,
          ticket_system_users: [
            ...ticket.ticket_system_users.slice(0, removed.index),
            removed.row,
            ...ticket.ticket_system_users.slice(removed.index)
          ]
        };
      });
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.cancelledLoad) {
        void queryClient.invalidateQueries({ queryKey: context.ticketQueryKey, exact: true });
      }
    }
  });
};
