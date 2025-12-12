import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IAvailableUser } from 'interfaces/useTeamsApi.interface';
import { useEffect } from 'react';

/**
 * Props for TeamMemberSelect component.
 */
export interface ITeamMemberSelectProps {
  /** Currently selected user IDs */
  selectedUserIds: number[];
  /** Callback when selection changes */
  onChange: (userIds: number[]) => void;
}

/**
 * Multi-select component for choosing team members from available users.
 *
 * Fetches available users from the API (excludes SYSTEM and DATABASE users).
 */
export const TeamMemberSelect = ({ selectedUserIds, onChange }: ITeamMemberSelectProps) => {
  const biohubApi = useApi();

  // Load available users
  const usersDataLoader = useDataLoader(() => biohubApi.teams.getAvailableUsers());

  useEffect(() => {
    usersDataLoader.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableUsers = usersDataLoader.data?.users ?? [];

  // Get selected user objects from IDs
  const selectedUsers = availableUsers.filter((u) => selectedUserIds.includes(u.system_user_id));

  return (
    <Autocomplete
      multiple
      options={availableUsers}
      value={selectedUsers}
      loading={usersDataLoader.isLoading}
      getOptionLabel={(user) => user.user_identifier}
      isOptionEqualToValue={(option, value) => option.system_user_id === value.system_user_id}
      onChange={(_, newValue) => {
        onChange(newValue.map((u) => u.system_user_id));
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Team Members"
          placeholder="Select users..."
          helperText="Select users to add to this team"
        />
      )}
      slotProps={{
        chip: {
          size: 'small'
        }
      }}
      renderOption={(props, user) => {
        const { key, ...otherProps } = props;
        return (
          <li key={key} {...otherProps}>
            <Typography>{user.user_identifier}</Typography>
          </li>
        );
      }}
      getOptionKey={(user: IAvailableUser) => user.system_user_id}
    />
  );
};
