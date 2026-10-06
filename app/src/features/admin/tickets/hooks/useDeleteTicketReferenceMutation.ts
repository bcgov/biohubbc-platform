import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended, ITicketReference } from 'interfaces/useTicketsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { useCoordinatedMutation, holdReload, cancelQueryForOptimisticUpdate } from 'hooks/useCoordinatedMutation';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

interface DeleteTicketReferenceContext {
  ticketId: string;
  ticketQueryKey: QueryKey;
  /** The removed reference and where it stood, to put it back on failure. */
  removed: { reference: ITicketReference; index: number } | undefined;
}

/**
 * Removes a reference from the route's ticket, hiding it before the request completes.
 *
 * On success the other cached details of both tickets the reference linked is refreshed.
 * A failure puts the reference back where it stood, unless it has reappeared since, and reports the error.
 *
 * @returns The mutation; call `mutate` with the reference id.
 */
export const useDeleteTicketReferenceMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useCoordinatedMutation<void, Error, string, DeleteTicketReferenceContext>({
    // Every change to the ticket shares this key, so reloads of the ticket wait for the last of them.
    mutationKey: ticketQueryKey,
    mutationFn: (ticketReferenceId) => api.tickets.deleteTicketReference(ticketId, ticketReferenceId),
    onMutate: async (ticketReferenceId) => {
      await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey, ticketQueryKey);
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
        ticketId,
        ticketQueryKey,
        removed: index > -1 ? { reference: references[index], index } : undefined
      };
    },
    onSuccess: async (_data, referenceId, context) => {
      await cancelQueryForOptimisticUpdate(queryClient, context.ticketQueryKey, context.ticketQueryKey);
      if (
        queryClient
          .getQueryData<ITicketExtended>(context.ticketQueryKey)
          ?.references.some((row) => row.ticket_reference_id === referenceId)
      ) {
        holdReload(queryClient, context.ticketQueryKey, context.ticketQueryKey);
      }
      void refreshChangedQueries(
        queryClient,
        context.removed
          ? changedQueryKeys.ticketReference(context.removed.reference)
          : changedQueryKeys.ticketDetail(context.ticketId),
        context.ticketQueryKey
      );
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
    }
  });
};
