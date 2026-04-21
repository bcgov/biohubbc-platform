import Stack from '@mui/material/Stack';
import { TeamForm } from 'components/form/TeamForm';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { useFormikContext } from 'formik';
import { IAvailableUser } from 'interfaces/useTeamsApi.interface';

interface ICreateDataRequestFormProps {
  options: SidebarOption[];
  isLoadingUsers: boolean;
  isSubmitting: boolean;
  onSearchUsers: (search: string) => void;
}

export interface ICreateDataRequestFormValues {
  reason: string;
  system_users: IAvailableUser[];
}

/**
 * Form body for creating a ticket data request.
 *
 * Manages selected team members through Formik field `system_users`.
 *
 * @param {ICreateDataRequestFormProps} props - Form props.
 * @returns {JSX.Element}
 */
export const CreateDataRequestForm = (props: ICreateDataRequestFormProps) => {
  const { options, isLoadingUsers, isSubmitting, onSearchUsers } = props;
  const { values, setFieldValue } = useFormikContext<ICreateDataRequestFormValues>();

  const users = values.system_users.map((user) => ({
    id: String(user.system_user_id),
    label: user.user_identifier
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
  };

  const handleRemoveUser = (userId: string) => {
    const removeUserId = Number(userId);
    const nextSystemUsers = values.system_users.filter((user) => user.system_user_id !== removeUserId);

    setFieldValue('system_users', nextSystemUsers);
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

      <TeamForm
        options={options}
        isLoading={isLoadingUsers}
        users={users}
        isSubmitting={isSubmitting}
        onSearch={onSearchUsers}
        onSelectUser={handleSelectUser}
        onRemoveUser={handleRemoveUser}
      />
    </Stack>
  );
};
