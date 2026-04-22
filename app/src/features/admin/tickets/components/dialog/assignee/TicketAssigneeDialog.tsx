import { EditDialog } from 'components/dialog/EditDialog';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import { useOptimisticDataLoader } from 'hooks/useOptimisticDataLoader';
import { ITicketAssignee } from 'interfaces/useTicketsApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketAssigneeDialogYup } from './TicketAssigneeDialogYup';
import { ITicketAssigneeFormValues, TicketAssigneeForm } from './form/TicketAssigneeForm';

interface ITicketAssigneeDialogProps {
  open: boolean;
  ticketId: string;
  onClose: () => void;
}

const TicketAssigneeFormInitialValues: ITicketAssigneeFormValues = {
  assignees: []
};

/**
 * Dialog for creating ticket assignees via ticket_system_user.
 *
 * @param {ITicketAssigneeDialogProps} props
 * @return {*}
 */
export const TicketAssigneeDialog = (props: ITicketAssigneeDialogProps) => {
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
    (assignees: ITicketAssigneeFormValues['assignees']) =>
      assignees.map((assignee) => ({
        system_user_id: assignee.system_user_id,
        status: assignee.status
      })),
    []
  );

  const buildOptimisticAssignees = useCallback(
    (assignees: ITicketAssigneeFormValues['assignees']): ITicketAssignee[] => {
      const nonce = Date.now();

      return assignees.map((assignee, index) => ({
        ticket_system_user_id: `optimistic-${assignee.system_user_id}-${nonce}-${index}`,
        ticket_id: ticketId,
        system_user_id: assignee.system_user_id,
        status: assignee.status,
        system_user: {
          system_user_id: assignee.system_user_id,
          display_name: null,
          user_identifier: assignee.user_identifier,
          email: null
        }
      }));
    },
    [ticketId]
  );

  const reconcileAssignees = useCallback(
    (
      optimisticAssignees: ITicketAssignee[],
      createdAssignees: ITicketAssignee[],
      draftsByUserId: Map<number, ITicketAssigneeFormValues['assignees'][number]>
    ) => {
      const createdByUserId = new Map(createdAssignees.map((assignee) => [assignee.system_user_id, assignee]));

      return optimisticAssignees.map((assignee) => {
        const created = createdByUserId.get(assignee.system_user_id);

        if (!created) {
          return assignee;
        }

        const draft = draftsByUserId.get(created.system_user_id);

        return {
          ...created,
          system_user: {
            system_user_id: created.system_user_id,
            display_name: assignee.system_user.display_name,
            user_identifier: draft?.user_identifier ?? assignee.system_user.user_identifier,
            email: assignee.system_user.email
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
    async (values: ITicketAssigneeFormValues) => {
      try {
        setIsSubmitting(true);

        const payload = buildCreatePayload(values.assignees);
        const draftsByUserId = new Map(values.assignees.map((assignee) => [assignee.system_user_id, assignee]));

        const result = await optimisticTicketLoader.refresh<ITicketAssignee[]>((currentTicket) => {
          const optimisticAssignees = buildOptimisticAssignees(values.assignees);

          return {
            optimisticState: {
              ...currentTicket,
              assignees: [...currentTicket.assignees, ...optimisticAssignees]
            },
            mutation: async () => api.tickets.createTicketAssignees(ticketId, payload),
            onSuccess: (createdAssignees, context) => {
              ticketDataLoader.setData({
                ...context.optimisticState,
                assignees: reconcileAssignees(context.optimisticState.assignees, createdAssignees, draftsByUserId)
              });
            }
          };
        });

        if (result === undefined) {
          await api.tickets.createTicketAssignees(ticketId, payload);
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
      buildOptimisticAssignees,
      dialogContext,
      onClose,
      optimisticTicketLoader,
      reconcileAssignees,
      ticketDataLoader,
      ticketId
    ]
  );

  return (
    <EditDialog<ITicketAssigneeFormValues>
      isLoading={isSubmitting}
      dialogTitle="Assign Ticket"
      dialogSaveButtonLabel="Assign"
      open={open}
      maxWidth="sm"
      component={{
        element: (
          <TicketAssigneeForm
            options={options}
            isLoadingUsers={availableUsersLoader.isLoading}
            isSubmitting={isSubmitting}
            onSearchUsers={handleSearchUsers}
          />
        ),
        initialValues: TicketAssigneeFormInitialValues,
        validationSchema: TicketAssigneeDialogYup
      }}
      onCancel={onClose}
      onSave={handleSubmit}
    />
  );
};
