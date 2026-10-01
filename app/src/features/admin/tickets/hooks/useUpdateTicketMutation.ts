import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicket, IUpdateTicketRequest } from 'interfaces/useTicketsApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { useCoordinatedMutation, holdReload } from 'hooks/useCoordinatedMutation';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

interface UpdateTicketContext {
  ticketId: string;
  ticketQueryKey: QueryKey;
}

/**
 * Saves ticket details and refreshes the server record after pending optimistic ticket changes settle.
 *
 * The edit dialog stays open while saving and closes on success. Failed saves leave the cached ticket unchanged.
 * The original ticket's detail key is captured so navigation cannot redirect the refresh to another ticket.
 *
 * @returns The mutation; call `mutate` with the fields to change.
 */
export const useUpdateTicketMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useCoordinatedMutation<ITicket, Error, IUpdateTicketRequest, UpdateTicketContext>({
    // Every change to the ticket shares this key, so reloads of the ticket wait for the last of them.
    mutationKey: ticketQueryKey,
    mutationFn: (payload) => api.tickets.updateTicket(ticketId, payload),
    onMutate: () => {
      return { ticketId, ticketQueryKey };
    },
    onSuccess: async (_updatedTicket, _payload, context) => {
      await queryClient.cancelQueries({ queryKey: context.ticketQueryKey, exact: true });
      holdReload(queryClient, context.ticketQueryKey, context.ticketQueryKey);
      refreshChangedQueries(queryClient, changedQueryKeys.ticket(context.ticketId), context.ticketQueryKey);
    },
    onError: (error) => setSnackbar({ open: true, snackbarMessage: error.message })
  });
};
