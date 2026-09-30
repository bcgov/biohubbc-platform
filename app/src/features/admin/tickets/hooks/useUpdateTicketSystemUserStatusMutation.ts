import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended, ITicketSystemUser, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import {
  cancelQueryForOptimisticUpdate,
  joinMutationGroup,
  refreshChangedQueries,
  settleMutationGroup
} from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/** A status change for one user assigned to the route's ticket. */
export interface UpdateTicketSystemUserStatusVariables {
  ticketSystemUserId: string;
  status: TicketSystemUserStatus;
}

interface UpdateTicketSystemUserStatusContext {
  ticketId: string;
  ticketQueryKey: QueryKey;
  /** The status before the change. */
  previousStatus: TicketSystemUserStatus | undefined;
  /** The optimistic row as cached; a later change to the row replaces this object. */
  optimisticRow: ITicketSystemUser | undefined;
}

/**
 * Changes an assigned user's status on the route's ticket, showing it before the request completes.
 *
 * On success the ticket's other cached details is refreshed.
 * A failure restores the row only while the cache still holds the row it wrote, so a later change to the same
 * user survives, and reports the error. Changes can overlap, so every failure is reported here.
 *
 * @returns The mutation; call `mutate` with {@link UpdateTicketSystemUserStatusVariables}.
 */
export const useUpdateTicketSystemUserStatusMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useMutation<
    ITicketSystemUser,
    Error,
    UpdateTicketSystemUserStatusVariables,
    UpdateTicketSystemUserStatusContext
  >({
    // Every change to the ticket shares this key, so reloads of the ticket wait for the last of them.
    mutationKey: ticketQueryKey,
    mutationFn: ({ ticketSystemUserId, status }) =>
      api.tickets.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, { status }),
    onMutate: async ({ ticketSystemUserId, status }) => {
      joinMutationGroup(queryClient, ticketQueryKey);
      await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey, ticketQueryKey);
      const previousStatus = queryClient
        .getQueryData<ITicketExtended>(ticketQueryKey)
        ?.ticket_system_users.find((row) => row.ticket_system_user_id === ticketSystemUserId)?.status;
      const ticket = queryClient.setQueryData<ITicketExtended>(
        ticketQueryKey,
        (current) =>
          current && {
            ...current,
            ticket_system_users: current.ticket_system_users.map((row) =>
              row.ticket_system_user_id === ticketSystemUserId ? { ...row, status } : row
            )
          }
      );
      const optimisticRow = ticket?.ticket_system_users.find((row) => row.ticket_system_user_id === ticketSystemUserId);
      return { ticketId, ticketQueryKey, previousStatus, optimisticRow };
    },
    onSuccess: (_data, _variables, context) =>
      refreshChangedQueries(queryClient, changedQueryKeys.ticketDetail(context.ticketId), context.ticketQueryKey),
    onError: (error, _variables, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      const previousStatus = context?.previousStatus;
      if (!previousStatus) {
        return;
      }
      queryClient.setQueryData<ITicketExtended>(
        context.ticketQueryKey,
        (ticket) =>
          ticket && {
            ...ticket,
            ticket_system_users: ticket.ticket_system_users.map((row) =>
              row === context.optimisticRow ? { ...row, status: previousStatus } : row
            )
          }
      );
    },
    onSettled: (_data, _error, _variables, context) =>
      settleMutationGroup(queryClient, context?.ticketQueryKey ?? ticketQueryKey)
  });
};
