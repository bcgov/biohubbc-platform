import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended, ITicketSystemUser, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { cancelQueryForOptimisticUpdate } from 'utils/query-client';

/** A status change for one user assigned to the route's ticket. */
export interface UpdateTicketSystemUserStatusVariables {
  ticketSystemUserId: string;
  status: TicketSystemUserStatus;
}

interface UpdateTicketSystemUserStatusContext {
  ticketQueryKey: QueryKey;
  cancelledLoad: boolean;
  /** The status before the change. */
  previousStatus: TicketSystemUserStatus | undefined;
  /** The optimistic row as cached; a later change to the row replaces this object. */
  optimisticRow: ITicketSystemUser | undefined;
}

/**
 * Changes an assigned user's status on the route's ticket, showing it before the request completes.
 *
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
    mutationFn: ({ ticketSystemUserId, status }) =>
      api.tickets.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, { status }),
    onMutate: async ({ ticketSystemUserId, status }) => {
      const cancelledLoad = await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey);
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
      return { ticketQueryKey, cancelledLoad, previousStatus, optimisticRow };
    },
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
    onSettled: (_data, _error, _variables, context) => {
      if (context?.cancelledLoad) {
        void queryClient.invalidateQueries({ queryKey: context.ticketQueryKey, exact: true });
      }
    }
  });
};
