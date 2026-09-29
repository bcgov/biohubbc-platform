import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended, ITicketReference } from 'interfaces/useTicketsApi.interface';
import { cancelQueryForOptimisticUpdate } from 'utils/query-client';

interface DeleteTicketReferenceContext {
  ticketQueryKey: QueryKey;
  cancelledLoad: boolean;
  /** The removed reference and where it stood, to put it back on failure. */
  removed: { reference: ITicketReference; index: number } | undefined;
}

/**
 * Removes a reference from the route's ticket, hiding it before the request completes.
 *
 * A failure puts the reference back where it stood, unless it has reappeared since, and reports the error.
 *
 * @returns The mutation; call `mutate` with the reference id.
 */
export const useDeleteTicketReferenceMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useMutation<void, Error, string, DeleteTicketReferenceContext>({
    mutationFn: (ticketReferenceId) => api.tickets.deleteTicketReference(ticketId, ticketReferenceId),
    onMutate: async (ticketReferenceId) => {
      const cancelledLoad = await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey);
      const references = queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.references ?? [];
      const index = references.findIndex((reference) => reference.ticket_reference_id === ticketReferenceId);
      queryClient.setQueryData<ITicketExtended>(
        ticketQueryKey,
        (ticket) =>
          ticket && {
            ...ticket,
            references: ticket.references.filter((reference) => reference.ticket_reference_id !== ticketReferenceId)
          }
      );
      return {
        ticketQueryKey,
        cancelledLoad,
        removed: index > -1 ? { reference: references[index], index } : undefined
      };
    },
    onError: (error, ticketReferenceId, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      const removed = context?.removed;
      if (!removed) {
        return;
      }
      queryClient.setQueryData<ITicketExtended>(context.ticketQueryKey, (ticket) => {
        if (!ticket || ticket.references.some((reference) => reference.ticket_reference_id === ticketReferenceId)) {
          return ticket;
        }
        return {
          ...ticket,
          references: [
            ...ticket.references.slice(0, removed.index),
            removed.reference,
            ...ticket.references.slice(removed.index)
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
