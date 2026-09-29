import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketSystemUserFormValues } from 'features/admin/tickets/components/dialog/system-user/form/TicketSystemUserForm';
import { ITicketExtended, ITicketSystemUser } from 'interfaces/useTicketsApi.interface';
import { cancelQueryForOptimisticUpdate } from 'utils/query-client';

interface CreateTicketSystemUsersContext {
  ticketQueryKey: QueryKey;
  cancelledLoad: boolean;
  /** The placeholder rows as cached. */
  placeholders: ITicketSystemUser[];
}

/**
 * Builds the placeholder rows shown for users being assigned.
 *
 * @param {string} ticketId The ticket the users are assigned to.
 * @param {ITicketSystemUserFormValues['ticketSystemUsers']} drafts The users being assigned, as entered.
 * @returns {ITicketSystemUser[]} One placeholder per user, with an id no server row can have.
 */
const buildPlaceholders = (
  ticketId: string,
  drafts: ITicketSystemUserFormValues['ticketSystemUsers']
): ITicketSystemUser[] => {
  const nonce = Date.now();
  return drafts.map((draft, index) => ({
    ticket_system_user_id: `optimistic-${draft.system_user_id}-${nonce}-${index}`,
    ticket_id: ticketId,
    system_user_id: draft.system_user_id,
    status: draft.status,
    system_user: {
      system_user_id: draft.system_user_id,
      display_name: draft.display_name,
      user_identifier: draft.user_identifier,
      email: null
    }
  }));
};

/**
 * Assigns users to the route's ticket, listing them before the request completes.
 *
 * On success each placeholder is replaced by the row the server created, keeping the user details the placeholder
 * showed, since the created rows carry ids only. A failure removes the placeholders and reports the error.
 *
 * @returns The mutation; call `mutate` with the users to assign.
 */
export const useCreateTicketSystemUsersMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { ticketId, ticketQueryKey } = useTicketContext();

  return useMutation<
    ITicketSystemUser[],
    Error,
    ITicketSystemUserFormValues['ticketSystemUsers'],
    CreateTicketSystemUsersContext
  >({
    mutationFn: (drafts) =>
      api.tickets.createTicketSystemUsers(
        ticketId,
        drafts.map((draft) => ({ system_user_id: draft.system_user_id, status: draft.status }))
      ),
    onMutate: async (drafts) => {
      const cancelledLoad = await cancelQueryForOptimisticUpdate(queryClient, ticketQueryKey);
      const placeholders = buildPlaceholders(ticketId, drafts);
      const ticket = queryClient.setQueryData<ITicketExtended>(
        ticketQueryKey,
        (current) => current && { ...current, ticket_system_users: [...current.ticket_system_users, ...placeholders] }
      );
      const placeholderIds = new Set(placeholders.map((row) => row.ticket_system_user_id));
      return {
        ticketQueryKey,
        cancelledLoad,
        placeholders: ticket?.ticket_system_users.filter((row) => placeholderIds.has(row.ticket_system_user_id)) ?? []
      };
    },
    onSuccess: (created, _drafts, context) => {
      const createdByUserId = new Map(created.map((row) => [row.system_user_id, row]));
      queryClient.setQueryData<ITicketExtended>(
        context.ticketQueryKey,
        (ticket) =>
          ticket && {
            ...ticket,
            ticket_system_users: ticket.ticket_system_users.map((row) => {
              const createdRow = context.placeholders.includes(row)
                ? createdByUserId.get(row.system_user_id)
                : undefined;
              return createdRow ? { ...createdRow, system_user: row.system_user } : row;
            })
          }
      );
    },
    onError: (error, _drafts, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      if (!context) {
        return;
      }
      queryClient.setQueryData<ITicketExtended>(
        context.ticketQueryKey,
        (ticket) =>
          ticket && {
            ...ticket,
            ticket_system_users: ticket.ticket_system_users.filter((row) => !context.placeholders.includes(row))
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
