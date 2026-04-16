import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { TicketTeamForm } from 'features/admin/tickets/components/dialog/team/form/TicketTeamForm';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { useFormikContext } from 'formik';
import { IAvailableUser, ITeamMember } from 'interfaces/useTeamsApi.interface';

interface ICreateDataRequestFormProps {
  options: SidebarOption[];
  isLoadingUsers: boolean;
  isSubmitting: boolean;
  onSearchUsers: (search: string) => void;
}

export interface ICreateDataRequestFormValues {
  reason: string;
  system_user_ids: number[];
  system_users: IAvailableUser[];
}

/**
 * Form body for creating a ticket data request.
 *
 * Manages selected team members through Formik fields and keeps
 * `system_users` and `system_user_ids` synchronized.
 *
 * @param {ICreateDataRequestFormProps} props - Form props.
 * @returns {JSX.Element}
 */
export const CreateDataRequestForm = (props: ICreateDataRequestFormProps) => {
  const { options, isLoadingUsers, isSubmitting, onSearchUsers } = props;
  const { values, setFieldValue } = useFormikContext<ICreateDataRequestFormValues>();

  const members: ITeamMember[] = values.system_users.map((user) => ({
    team_member_id: String(user.system_user_id),
    system_user_id: user.system_user_id,
    user_identifier: user.user_identifier
  }));

  const handleSelectUser = (option: SidebarOption | null) => {
    if (!option) {
      return;
    }

    const selectedUserId = Number(option.value);
    if (values.system_users.some((user) => user.system_user_id === selectedUserId)) {
      return;
    }

    const nextSystemUsers: IAvailableUser[] = [
      ...values.system_users,
      {
        system_user_id: selectedUserId,
        user_identifier: option.label
      }
    ];

    setFieldValue('system_users', nextSystemUsers);
    setFieldValue(
      'system_user_ids',
      nextSystemUsers.map((user) => user.system_user_id)
    );
  };

  const handleRemoveMember = (teamMemberId: string) => {
    const removeUserId = Number(teamMemberId);
    const nextSystemUsers = values.system_users.filter((user) => user.system_user_id !== removeUserId);

    setFieldValue('system_users', nextSystemUsers);
    setFieldValue(
      'system_user_ids',
      nextSystemUsers.map((user) => user.system_user_id)
    );
  };

  return (
    <Stack gap={2} sx={{ pt: 1, minWidth: { xs: 300, sm: 520 } }}>
      <CustomTextFieldFormik
        label="Reason"
        name="reason"
        required
        multiline
        minRows={4}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />

      <TicketTeamForm
        options={options}
        isLoading={isLoadingUsers}
        members={members}
        isSubmitting={isSubmitting}
        onSearch={onSearchUsers}
        onSelectUser={handleSelectUser}
        onRemoveAssignee={handleRemoveMember}
      />
    </Stack>
  );
};
