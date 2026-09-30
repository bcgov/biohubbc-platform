import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicket, ITicketExtended, IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import {
  cancelQueryForOptimisticUpdate,
  holdReloadIfConcurrent,
  joinMutationGroup,
  refreshChangedQueries,
  settleMutationGroup
} from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

interface UpdateTicketContext {
  ticketId: string;
  ticketQueryKey: QueryKey;
  /** The edited fields as they were before the edit. */
  previous: IUpdateTicketRequest | undefined;
}

/**
 * Picks the fields an edit can change from a ticket.
 *
 * @param {ITicket} ticket The ticket.
 * @returns {Required<IUpdateTicketRequest>} Its subject, description, priority and status.
 */
const editableFields = (ticket: ITicket): Required<IUpdateTicketRequest> => ({
  subject: ticket.subject,
  description: ticket.description,
  priority: ticket.priority,
  status: ticket.status
});

/**
 * Saves an edit of the route's ticket, showing it before the request completes.
 *
 * On success the server's ticket fields are merged into the cached ticket, keeping its timeline, comments and
 * references, unless other changes to the ticket were saved alongside, in which case it reloads once they settle.
 * Every other cached copy of the ticket is refreshed. A failure restores each edited field
 * that still holds the edited value, and reports the error.
 *
 * @returns The mutation; call `mutate` with the fields to change.
 */
export const useUpdateTicketMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useMutation<ITicket, Error, IUpdateTicketRequest, UpdateTicketContext>({
    // Every change to the ticket shares this key, so reloads of the ticket wait for the last of them.
    mutationKey: ticketQueryKey,
    mutationFn: (payload) => api.tickets.updateTicket(ticketId, payload),
    onMutate: async (payload) => {
      joinMutationGroup(queryClient, ticketQueryKey);
      await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey, ticketQueryKey);
      const current = queryClient.getQueryData<ITicketExtended>(ticketQueryKey);
      queryClient.setQueryData<ITicketExtended>(ticketQueryKey, (ticket) => ticket && { ...ticket, ...payload });
      return { ticketId, ticketQueryKey, previous: current && editableFields(current) };
    },
    onSuccess: (updatedTicket, _payload, context) => {
      // A response saved alongside other changes to the ticket can predate them, so it is written only when no other
      // change is running; otherwise the ticket reloads once they have all settled.
      if (!holdReloadIfConcurrent(queryClient, context.ticketQueryKey, context.ticketQueryKey)) {
        queryClient.setQueryData<ITicketExtended>(
          context.ticketQueryKey,
          (ticket) =>
            ticket && {
              ...ticket,
              ...updatedTicket,
              statuses: ticket.statuses,
              comments: ticket.comments,
              references: ticket.references
            }
        );
      }
      refreshChangedQueries(queryClient, changedQueryKeys.ticket(context.ticketId), context.ticketQueryKey);
    },
    onError: (error, payload, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      const previous = context?.previous;
      if (!previous) {
        return;
      }
      queryClient.setQueryData<ITicketExtended>(context.ticketQueryKey, (ticket) => {
        if (!ticket) {
          return ticket;
        }
        const restored = { ...ticket };
        for (const field of Object.keys(payload) as (keyof IUpdateTicketRequest)[]) {
          if (ticket[field] === payload[field]) {
            Object.assign(restored, { [field]: previous[field] });
          }
        }
        return restored;
      });
    },
    onSettled: (_data, _error, _variables, context) =>
      settleMutationGroup(queryClient, context?.ticketQueryKey ?? ticketQueryKey)
  });
};
