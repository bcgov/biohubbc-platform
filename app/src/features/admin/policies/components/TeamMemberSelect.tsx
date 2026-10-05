import { mdiAccountOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import useDebounce from 'hooks/useDebounce';
import { IAvailableUser } from 'interfaces/useTeamsApi.interface';
import { useCallback, useMemo, useState } from 'react';
import { userQueryKeys } from 'utils/query-keys/user-query-keys';
import { getUserLabel } from 'utils/Utils';

/**
 * Props for TeamMemberSelect component.
 */
export interface ITeamMemberSelectProps {
  /** Currently selected users (full objects from formik state) */
  selectedUsers: IAvailableUser[];
  /** Callback when selection changes — returns full user objects */
  onChange: (users: IAvailableUser[]) => void;
}

/**
 * Multi-select component for choosing team members from available users.
 *
 * Uses server-side search for scalability with large user bases.
 * Fetches available users from the API (excludes SYSTEM and DATABASE users).
 */
export const TeamMemberSelect = ({ selectedUsers, onChange }: ITeamMemberSelectProps) => {
  const biohubApi = useApi();

  // Track the search input value
  const [inputValue, setInputValue] = useState('');

  // The search applied to the user list, which trails the input by the debounce delay
  const [userSearch, setUserSearch] = useState('');

  const usersQuery = useQuery({
    queryKey: userQueryKeys.available(userSearch),
    queryFn: ({ signal }) => biohubApi.teams.getAvailableUsers(userSearch, { signal }),
    placeholderData: keepPreviousData
  });

  const debouncedSearch = useDebounce(setUserSearch, 300);

  /**
   * Handle input value changes - triggers debounced search.
   * Only updates input value on user typing, not on reset/clear events.
   */
  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, value: string, reason: string) => {
      // Only update input and search on actual user input
      if (reason === 'input') {
        setInputValue(value);
        debouncedSearch(value);
      } else if (reason === 'clear') {
        // Allow clearing the input
        setInputValue('');
        debouncedSearch('');
      }
      // Ignore 'reset' reason - this fires when options change and would clear our input
    },
    [debouncedSearch]
  );

  // Merge search results with selected users to ensure selected users are always visible
  const availableOptions = useMemo(() => {
    const searchResults = usersQuery.data?.users ?? [];
    const optionsMap = new Map<number, IAvailableUser>();

    // Add all search results
    for (const user of searchResults) {
      optionsMap.set(user.system_user_id, user);
    }

    // Add selected users (ensures they appear even if not in search results)
    for (const user of selectedUsers) {
      if (!optionsMap.has(user.system_user_id)) {
        optionsMap.set(user.system_user_id, user);
      }
    }

    return Array.from(optionsMap.values()).sort((a, b) => getUserLabel(a).localeCompare(getUserLabel(b)));
  }, [usersQuery.data?.users, selectedUsers]);

  /**
   * Handle selection changes - notify parent with full user objects.
   */
  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: IAvailableUser[]) => {
      onChange(newValue);
    },
    [onChange]
  );

  return (
    <Autocomplete
      multiple
      options={availableOptions}
      value={selectedUsers}
      inputValue={inputValue}
      loading={usersQuery.isFetching}
      getOptionLabel={(user) => getUserLabel(user)}
      isOptionEqualToValue={(option, value) => option.system_user_id === value.system_user_id}
      onInputChange={handleInputChange}
      onChange={handleChange}
      // Disable client-side filtering - server handles it
      filterOptions={(x) => x}
      renderInput={(params) => <TextField {...params} label="Team Members" placeholder="Search users..." />}
      slotProps={{
        chip: {
          size: 'small'
        }
      }}
      renderOption={(props, user) => {
        const { key, ...otherProps } = props;
        return (
          <li key={key} {...otherProps}>
            <Box display="flex" alignItems="center" gap={1}>
              <Icon path={mdiAccountOutline} size={0.875} />
              <Typography>{getUserLabel(user)}</Typography>
            </Box>
          </li>
        );
      }}
      getOptionKey={(user: IAvailableUser) => user.system_user_id}
    />
  );
};
