import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { useApi } from 'hooks/useApi';
import useDebounce from 'hooks/useDebounce';
import { useMemo, useState } from 'react';
import { userQueryKeys } from 'utils/query-keys/user-query-keys';
import { getUserLabel } from 'utils/Utils';
import { useCreateTicketSystemUsersMutation } from '../../../hooks/useCreateTicketSystemUsersMutation';
import { TicketSystemUserDialogYup } from './TicketSystemUserDialogYup';
import { ITicketSystemUserFormValues, TicketSystemUserForm } from './form/TicketSystemUserForm';

interface ITicketSystemUserDialogProps {
  open: boolean;
  onClose: () => void;
}

const TicketSystemUserFormInitialValues: ITicketSystemUserFormValues = {
  ticketSystemUsers: []
};

/**
 * Dialog for assigning users to the route's ticket.
 *
 * @param {ITicketSystemUserDialogProps} props
 * @return {*}
 */
export const TicketSystemUserDialog = (props: ITicketSystemUserDialogProps) => {
  const { open, onClose } = props;
  const api = useApi();
  const createMutation = useCreateTicketSystemUsersMutation();
  const [userSearch, setUserSearch] = useState('');

  const availableUsersQuery = useQuery({
    queryKey: userQueryKeys.available(userSearch),
    queryFn: ({ signal }) => api.teams.getAvailableUsers(userSearch, { signal }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const debouncedUserSearch = useDebounce(setUserSearch, 300);

  const availableUsers = useMemo(() => availableUsersQuery.data?.users ?? [], [availableUsersQuery.data?.users]);
  const options = useMemo<SearchOption[]>(
    () =>
      availableUsers.map((user) => ({
        value: user.system_user_id,
        label: getUserLabel(user)
      })),
    [availableUsers]
  );

  /**
   * Assigns the chosen users; the dialog closes on success and stays open on failure, which the mutation reports.
   *
   * @param {ITicketSystemUserFormValues} values The users to assign.
   * @return {void}
   */
  const handleSubmit = (values: ITicketSystemUserFormValues) => {
    createMutation.mutate(values.ticketSystemUsers, { onSuccess: onClose });
  };

  return (
    <EditDialog<ITicketSystemUserFormValues>
      isLoading={createMutation.isPending}
      dialogTitle="Assign Ticket"
      dialogSaveButtonLabel="Assign"
      open={open}
      maxWidth="sm"
      component={{
        element: (
          <TicketSystemUserForm
            options={options}
            availableUsers={availableUsers}
            isLoadingUsers={availableUsersQuery.isFetching}
            isSubmitting={createMutation.isPending}
            onSearchUsers={debouncedUserSearch}
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
