import Stack from '@mui/material/Stack';
import { TeamForm } from 'components/form/TeamForm';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { useFormikContext } from 'formik';
import { IAvailableUser } from 'interfaces/useTeamsApi.interface';

interface ICreateDataRequestFormProps {
  options: SearchOption[];
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
 * The `system_users` picker has caller-dependent semantics. From the user/search flow it
 * selects *additional collaborators* on top of the requester (empty is valid — the requester
 * is added server-side via the `requested_by` union). From the admin/ticket flow it selects
 * *the* access list; an empty selection is currently accepted but semantically nonsensical
 * because the admin is not themselves the requester.
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

  const handleSelectUser = (option: SearchOption | null) => {
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
