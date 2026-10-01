import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicket, ITicketExtended, ITicketStatusLog, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import {
  useCoordinatedMutation,
  cancelQueryForOptimisticUpdate,
  holdReloadIfConcurrent
} from 'hooks/useCoordinatedMutation';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/** A close or reopen of the route's ticket. */
export interface UpdateTicketStatusVariables {
  status: TicketStatus;
  /** Shown as the author of the optimistic timeline entry; without one, no entry is added. */
  userIdentifier: string | undefined;
}

interface UpdateTicketStatusContext {
  ticketId: string;
  ticketQueryKey: QueryKey;
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
 * references, unless other changes to the ticket were saved alongside, in which case it reloads once they settle.
 * Every other cached copy of the ticket is refreshed. A failure removes the optimistic timeline entry and restores the
 * status, unless something has changed the status since.
 *
 * @returns The mutation; call `mutate` with {@link UpdateTicketStatusVariables}.
 */
export const useUpdateTicketStatusMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useCoordinatedMutation<ITicket, Error, UpdateTicketStatusVariables, UpdateTicketStatusContext>({
    // Every change to the ticket shares this key, so reloads of the ticket wait for the last of them.
    mutationKey: ticketQueryKey,
    mutationFn: ({ status }) => api.tickets.updateTicketStatus(ticketId, status),
    onMutate: async ({ status, userIdentifier }) => {
      holdReloadIfConcurrent(queryClient, ticketQueryKey, ticketQueryKey);
      await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey, ticketQueryKey);
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
        ticketId,
        ticketQueryKey,
        optimisticStatus: ticket?.statuses.find(
          (entry) => entry.ticket_status_id === optimisticStatus?.ticket_status_id
        )
      };
    },
    onSuccess: async (updatedTicket, _variables, context) => {
      await cancelQueryForOptimisticUpdate(queryClient, context.ticketQueryKey, context.ticketQueryKey);
      // A response saved alongside other changes to the ticket can predate them, so it is written only when no other
      // change is running; otherwise the ticket reloads once they have all settled.
      if (!holdReloadIfConcurrent(queryClient, context.ticketQueryKey, context.ticketQueryKey)) {
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
      }
      refreshChangedQueries(queryClient, changedQueryKeys.ticket(context.ticketId), context.ticketQueryKey);
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
    }
  });
};
