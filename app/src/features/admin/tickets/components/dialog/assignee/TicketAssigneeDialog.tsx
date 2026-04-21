import { EditDialog } from 'components/dialog/EditDialog';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketAssigneeDialogYup } from './TicketAssigneeDialogYup';
import { ITicketAssigneeFormValues, TicketAssigneeForm } from './form/TicketAssigneeForm';

interface ITicketAssigneeDialogProps {
  open: boolean;
  ticketId: string;
  onClose: () => void;
  onAssigned: () => Promise<void> | void;
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
  const { open, ticketId, onClose, onAssigned } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableUsersLoader = useDataLoader((search?: string) => api.teams.getAvailableUsers(search));

  const debouncedAvailableUserRefresh = useDebounce((search: string) => {
    availableUsersLoader.refresh(search);
  }, 300);

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

        await api.tickets.createTicketAssignees(
          ticketId,
          values.assignees.map((assignee) => ({
            system_user_id: assignee.system_user_id,
            status: assignee.status
          }))
        );

        await onAssigned();
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
    [api.tickets, dialogContext, onAssigned, onClose, ticketId]
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
            onSearchUsers={(search) => debouncedAvailableUserRefresh(search)}
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
