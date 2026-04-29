import Stack from '@mui/material/Stack';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { TICKET_SYSTEM_USER_STATUS_PRESENTATION } from 'constants/ticket';
import { SearchAutocomplete } from 'features/search/result/sidebar/search/components/section/autocomplete/SearchAutocomplete';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { ArrayHelpers, FieldArray, getIn, useFormikContext } from 'formik';
import { TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';
import { TicketSystemUserCard } from './TicketSystemUserCard';

export interface ITicketSystemUserFormValues {
  ticketSystemUsers: {
    system_user_id: number;
    user_identifier: string;
    status: TicketSystemUserStatus;
  }[];
}

interface ITicketSystemUserFormProps {
  options: SidebarOption[];
  isLoadingUsers: boolean;
  isSubmitting: boolean;
  onSearchUsers: (search: string) => void;
}

/**
 * Form body for assigning one or more users to a ticket.
 *
 * @param {ITicketSystemUserFormProps} props
 * @return {*}
 */
export const TicketSystemUserForm = (props: ITicketSystemUserFormProps) => {
  const { options, isLoadingUsers, isSubmitting, onSearchUsers } = props;
  const { values, errors, touched } = useFormikContext<ITicketSystemUserFormValues>();
  const statusOptions = useMemo<Array<{ value: TicketSystemUserStatus; label: string; iconPath: string }>>(
    () =>
      (
        Object.entries(TICKET_SYSTEM_USER_STATUS_PRESENTATION) as Array<
          [TicketSystemUserStatus, (typeof TICKET_SYSTEM_USER_STATUS_PRESENTATION)[TicketSystemUserStatus]]
        >
      ).map(([value, presentation]) => ({
        value,
        label: presentation.label,
        iconPath: presentation.icon
      })),
    []
  );

  const handleSelectUser = (option: SidebarOption | null, arrayHelpers: ArrayHelpers) => {
    if (!option) {
      return;
    }

    const selectedUserId = Number(option.value);

    if (values.ticketSystemUsers.some((ticketSystemUser) => ticketSystemUser.system_user_id === selectedUserId)) {
      return;
    }

    arrayHelpers.push({
      system_user_id: selectedUserId,
      user_identifier: option.label,
      status: 'requested'
    });
  };

  const handleChangeTicketSystemUserStatus = (
    index: number,
    status: TicketSystemUserStatus,
    arrayHelpers: ArrayHelpers
  ) => {
    const ticketSystemUser = values.ticketSystemUsers[index];
    if (!ticketSystemUser) {
      return;
    }

    arrayHelpers.replace(index, {
      ...ticketSystemUser,
      status
    });
  };

  const ticketSystemUsersError = getIn(errors, 'ticketSystemUsers');
  const ticketSystemUsersTouched = getIn(touched, 'ticketSystemUsers');

  return (
    <Stack spacing={2.5} sx={{ mt: 1 }}>
      <FieldArray
        name="ticketSystemUsers"
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

            {values.ticketSystemUsers.length ? (
              <Stack spacing={1}>
                {values.ticketSystemUsers.map((ticketSystemUser, index) => (
                  <TicketSystemUserCard
                    key={ticketSystemUser.system_user_id}
                    systemUserId={ticketSystemUser.system_user_id}
                    userIdentifier={ticketSystemUser.user_identifier}
                    status={ticketSystemUser.status}
                    statusOptions={statusOptions}
                    isSubmitting={isSubmitting}
                    onChangeStatus={(_, status) => handleChangeTicketSystemUserStatus(index, status, arrayHelpers)}
                    onRemoveTicketSystemUser={() => arrayHelpers.remove(index)}
                  />
                ))}
              </Stack>
            ) : null}
          </>
        )}
      />

      {ticketSystemUsersTouched && typeof ticketSystemUsersError === 'string' ? (
        <AlertBanner severity="error">{ticketSystemUsersError}</AlertBanner>
      ) : null}
    </Stack>
  );
};
