import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended, ITicketSystemUser } from 'interfaces/useTicketsApi.interface';
import {
  cancelQueryForOptimisticUpdate,
  joinMutationGroup,
  refreshChangedQueries,
  settleMutationGroup
} from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

interface RemoveTicketSystemUserContext {
  ticketId: string;
  ticketQueryKey: QueryKey;
  /** The removed row and where it stood, to put it back on failure. */
  removed: { row: ITicketSystemUser; index: number } | undefined;
}

/**
 * Removes an assigned user from the route's ticket, hiding the user before the request completes.
 *
 * On success the ticket's other cached details is refreshed.
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
    // Every change to the ticket shares this key, so reloads of the ticket wait for the last of them.
    mutationKey: ticketQueryKey,
    mutationFn: (ticketSystemUserId) => api.tickets.deleteTicketSystemUser(ticketId, ticketSystemUserId),
    onMutate: async (ticketSystemUserId) => {
      joinMutationGroup(queryClient, ticketQueryKey);
      await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey, ticketQueryKey);
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
      return { ticketId, ticketQueryKey, removed: index > -1 ? { row: rows[index], index } : undefined };
    },
    onSuccess: (_data, _variables, context) =>
      refreshChangedQueries(queryClient, changedQueryKeys.ticketDetail(context.ticketId), context.ticketQueryKey),
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
    onSettled: (_data, _error, _variables, context) =>
      settleMutationGroup(queryClient, context?.ticketQueryKey ?? ticketQueryKey)
  });
};
