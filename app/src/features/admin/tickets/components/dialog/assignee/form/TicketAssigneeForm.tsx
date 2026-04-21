import Stack from '@mui/material/Stack';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { SearchAutocomplete } from 'features/search/result/sidebar/search/components/section/autocomplete/SearchAutocomplete';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { ArrayHelpers, FieldArray, getIn, useFormikContext } from 'formik';
import { TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { TicketAssigneeCard } from './TicketAssigneeCard';

export interface ITicketAssigneeFormValues {
  assignees: {
    system_user_id: number;
    user_identifier: string;
    status: TicketSystemUserStatus;
  }[];
}

interface ITicketAssigneeFormProps {
  options: SidebarOption[];
  isLoadingUsers: boolean;
  isSubmitting: boolean;
  onSearchUsers: (search: string) => void;
}

const statusOptions: Array<{ value: TicketSystemUserStatus; label: string }> = [
  { value: 'requested', label: 'Requested' },
  { value: 'started', label: 'Started' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'resolved', label: 'Resolved' }
];

/**
 * Form body for assigning one or more users to a ticket.
 *
 * @param {ITicketAssigneeFormProps} props
 * @return {*}
 */
export const TicketAssigneeForm = (props: ITicketAssigneeFormProps) => {
  const { options, isLoadingUsers, isSubmitting, onSearchUsers } = props;
  const { values, errors, touched } = useFormikContext<ITicketAssigneeFormValues>();

  const handleSelectUser = (option: SidebarOption | null, arrayHelpers: ArrayHelpers) => {
    if (!option) {
      return;
    }

    const selectedUserId = Number(option.value);

    if (values.assignees.some((assignee) => assignee.system_user_id === selectedUserId)) {
      return;
    }

    arrayHelpers.push({
      system_user_id: selectedUserId,
      user_identifier: option.label,
      status: 'requested'
    });
  };

  const handleChangeAssigneeStatus = (index: number, status: TicketSystemUserStatus, arrayHelpers: ArrayHelpers) => {
    const assignee = values.assignees[index];
    if (!assignee) {
      return;
    }

    arrayHelpers.replace(index, {
      ...assignee,
      status
    });
  };

  const assigneesError = getIn(errors, 'assignees');
  const assigneesTouched = getIn(touched, 'assignees');

  return (
    <Stack spacing={2.5} sx={{ mt: 1 }}>
      <FieldArray
        name="assignees"
        render={(arrayHelpers) => (
          <>
            <SearchAutocomplete
              options={options}
              value={null}
              size="medium"
              placeholder="Search users"
              loading={isLoadingUsers}
              disabled={isSubmitting}
              onInputChange={onSearchUsers}
              onChange={(option) => handleSelectUser(option, arrayHelpers)}
            />

            {values.assignees.length ? (
              <Stack spacing={1}>
                {values.assignees.map((assignee, index) => (
                  <TicketAssigneeCard
                    key={assignee.system_user_id}
                    systemUserId={assignee.system_user_id}
                    userIdentifier={assignee.user_identifier}
                    status={assignee.status}
                    statusOptions={statusOptions}
                    isSubmitting={isSubmitting}
                    onChangeStatus={(_, status) => handleChangeAssigneeStatus(index, status, arrayHelpers)}
                    onRemoveAssignee={() => arrayHelpers.remove(index)}
                  />
                ))}
              </Stack>
            ) : null}
          </>
        )}
      />

      {assigneesTouched && typeof assigneesError === 'string' ? (
        <AlertBanner severity="error">{assigneesError}</AlertBanner>
      ) : null}
    </Stack>
  );
};
