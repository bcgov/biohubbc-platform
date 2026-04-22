import { EditDialog } from 'components/dialog/EditDialog';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import { useOptimisticDataLoader } from 'hooks/useOptimisticDataLoader';
import { ITicketSystemUser } from 'interfaces/useTicketsApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketSystemUserDialogYup } from './TicketSystemUserDialogYup';
import { ITicketSystemUserFormValues, TicketSystemUserForm } from './form/TicketSystemUserForm';

interface ITicketSystemUserDialogProps {
  open: boolean;
  ticketId: string;
  onClose: () => void;
}

const TicketSystemUserFormInitialValues: ITicketSystemUserFormValues = {
  ticketSystemUsers: []
};

/**
 * Dialog for creating ticket system users via ticket_system_user.
 *
 * @param {ITicketSystemUserDialogProps} props
 * @return {*}
 */
export const TicketSystemUserDialog = (props: ITicketSystemUserDialogProps) => {
  const { open, ticketId, onClose } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const optimisticTicketLoader = useOptimisticDataLoader(ticketDataLoader);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableUsersLoader = useDataLoader((search?: string) => api.teams.getAvailableUsers(search));

  const debouncedAvailableUserRefresh = useDebounce((search: string) => {
    availableUsersLoader.refresh(search);
  }, 300);

  const buildCreatePayload = useCallback(
    (ticketSystemUsers: ITicketSystemUserFormValues['ticketSystemUsers']) =>
      ticketSystemUsers.map((ticketSystemUser) => ({
        system_user_id: ticketSystemUser.system_user_id,
        status: ticketSystemUser.status
      })),
    []
  );

  const buildOptimisticTicketSystemUsers = useCallback(
    (ticketSystemUsers: ITicketSystemUserFormValues['ticketSystemUsers']): ITicketSystemUser[] => {
      const nonce = Date.now();

      return ticketSystemUsers.map((ticketSystemUser, index) => ({
        ticket_system_user_id: `optimistic-${ticketSystemUser.system_user_id}-${nonce}-${index}`,
        ticket_id: ticketId,
        system_user_id: ticketSystemUser.system_user_id,
        status: ticketSystemUser.status,
        system_user: {
          system_user_id: ticketSystemUser.system_user_id,
          display_name: null,
          user_identifier: ticketSystemUser.user_identifier,
          email: null
        }
      }));
    },
    [ticketId]
  );

  const reconcileTicketSystemUsers = useCallback(
    (
      optimisticTicketSystemUsers: ITicketSystemUser[],
      createdTicketSystemUsers: ITicketSystemUser[],
      draftsByUserId: Map<number, ITicketSystemUserFormValues['ticketSystemUsers'][number]>
    ) => {
      const createdByUserId = new Map(
        createdTicketSystemUsers.map((ticketSystemUser) => [ticketSystemUser.system_user_id, ticketSystemUser])
      );

      return optimisticTicketSystemUsers.map((ticketSystemUser) => {
        const created = createdByUserId.get(ticketSystemUser.system_user_id);

        if (!created) {
          return ticketSystemUser;
        }

        const draft = draftsByUserId.get(created.system_user_id);

        return {
          ...created,
          system_user: {
            system_user_id: created.system_user_id,
            display_name: ticketSystemUser.system_user.display_name,
            user_identifier: draft?.user_identifier ?? ticketSystemUser.system_user.user_identifier,
            email: ticketSystemUser.system_user.email
          }
        };
      });
    },
    []
  );

  const handleSearchUsers = useCallback(
    (search: string) => {
      debouncedAvailableUserRefresh(search);
    },
    [debouncedAvailableUserRefresh]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    availableUsersLoader.load();
  }, [open, availableUsersLoader]);

  const options = useMemo<SidebarOption[]>(
    () =>
      (availableUsersLoader.data?.users ?? []).map((user) => ({
        value: user.system_user_id,
        label: user.user_identifier
      })),
    [availableUsersLoader.data?.users]
  );

  const handleSubmit = useCallback(
    async (values: ITicketSystemUserFormValues) => {
      try {
        setIsSubmitting(true);

        const payload = buildCreatePayload(values.ticketSystemUsers);
        const draftsByUserId = new Map(
          values.ticketSystemUsers.map((ticketSystemUser) => [ticketSystemUser.system_user_id, ticketSystemUser])
        );

        const result = await optimisticTicketLoader.refresh<ITicketSystemUser[]>((currentTicket) => {
          const optimisticTicketSystemUsers = buildOptimisticTicketSystemUsers(values.ticketSystemUsers);
          const currentTicketSystemUsers = currentTicket.ticket_system_users ?? [];

          return {
            optimisticState: {
              ...currentTicket,
              ticket_system_users: [...currentTicketSystemUsers, ...optimisticTicketSystemUsers]
            },
            mutation: async () => api.tickets.createTicketSystemUsers(ticketId, payload),
            onSuccess: (createdTicketSystemUsers, context) => {
              ticketDataLoader.setData({
                ...context.optimisticState,
                ticket_system_users: reconcileTicketSystemUsers(
                  context.optimisticState.ticket_system_users,
                  createdTicketSystemUsers,
                  draftsByUserId
                )
              });
            }
          };
        });

        if (result === undefined) {
          await api.tickets.createTicketSystemUsers(ticketId, payload);
        }

        onClose();
      } catch (error) {
        const apiError = error as APIError;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: apiError.message
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      api.tickets,
      buildCreatePayload,
      buildOptimisticTicketSystemUsers,
      dialogContext,
      onClose,
      optimisticTicketLoader,
      reconcileTicketSystemUsers,
      ticketDataLoader,
      ticketId
    ]
  );

  return (
    <EditDialog<ITicketSystemUserFormValues>
      isLoading={isSubmitting}
      dialogTitle="Assign Ticket"
      dialogSaveButtonLabel="Assign"
      open={open}
      maxWidth="sm"
      component={{
        element: (
          <TicketSystemUserForm
            options={options}
            isLoadingUsers={availableUsersLoader.isLoading}
            isSubmitting={isSubmitting}
            onSearchUsers={handleSearchUsers}
          />
        ),
        initialValues: TicketSystemUserFormInitialValues,
        validationSchema: TicketSystemUserDialogYup
      }}
      onCancel={onClose}
      onSave={handleSubmit}
    />
  );
};
