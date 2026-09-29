import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicket, ITicketExtended, ITicketStatusLog, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { cancelQueryForOptimisticUpdate } from 'utils/query-client';

/** A close or reopen of the route's ticket. */
export interface UpdateTicketStatusVariables {
  status: TicketStatus;
  /** Shown as the author of the optimistic timeline entry; without one, no entry is added. */
  userIdentifier: string | undefined;
}

interface UpdateTicketStatusContext {
  ticketQueryKey: QueryKey;
  cancelledLoad: boolean;
  /** The timeline entry written optimistically, as cached. */
  optimisticStatus: ITicketStatusLog | undefined;
}

/**
 * The status a ticket had before being moved to the given one; a ticket is only ever toggled.
 *
 * @param {TicketStatus} status The status the ticket was moved to.
 * @returns {TicketStatus} The status it was moved from.
 */
const previousStatus = (status: TicketStatus): TicketStatus => (status === 'open' ? 'closed' : 'open');

/**
 * Closes or reopens the route's ticket, showing the new status and its timeline entry before the request completes.
 *
 * On success the server's ticket fields are merged into the cached ticket, keeping its timeline, comments and
 * references. A failure removes
 * the optimistic timeline entry and restores the status, unless something has changed the status since.
 *
 * @returns The mutation; call `mutate` with {@link UpdateTicketStatusVariables}.
 */
export const useUpdateTicketStatusMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useMutation<ITicket, Error, UpdateTicketStatusVariables, UpdateTicketStatusContext>({
    mutationFn: ({ status }) => api.tickets.updateTicketStatus(ticketId, status),
    onMutate: async ({ status, userIdentifier }) => {
      const cancelledLoad = await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey);
      const optimisticStatus: ITicketStatusLog | undefined = userIdentifier
        ? {
            ticket_status_id: `optimistic-status-${Date.now()}`,
            ticket_id: ticketId,
            user_identifier: userIdentifier,
            create_date: new Date().toISOString(),
            status
          }
        : undefined;
      const ticket = queryClient.setQueryData<ITicketExtended>(
        ticketQueryKey,
        (current) =>
          current && {
            ...current,
            status,
            statuses: optimisticStatus ? [...current.statuses, optimisticStatus] : current.statuses
          }
      );
      return {
        ticketQueryKey,
        cancelledLoad,
        optimisticStatus: ticket?.statuses.find(
          (entry) => entry.ticket_status_id === optimisticStatus?.ticket_status_id
        )
      };
    },
    onSuccess: (updatedTicket, _variables, context) => {
      queryClient.setQueryData<ITicketExtended>(
        context.ticketQueryKey,
        (current) =>
          current && {
            ...current,
            ...updatedTicket,
            statuses: current.statuses,
            comments: current.comments,
            references: current.references
          }
      );
    },
    onError: (error, { status }, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      if (!context) {
        return;
      }
      queryClient.setQueryData<ITicketExtended>(
        context.ticketQueryKey,
        (current) =>
          current && {
            ...current,
            status: current.status === status ? previousStatus(status) : current.status,
            statuses: current.statuses.filter((entry) => entry !== context.optimisticStatus)
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
