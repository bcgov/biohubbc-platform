import { mdiAccountOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IAvailableUser } from 'interfaces/useTeamsApi.interface';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Props for TeamMemberSelect component.
 */
export interface ITeamMemberSelectProps {
  /** Currently selected user IDs */
  selectedUserIds: number[];
  /** Callback when selection changes */
  onChange: (userIds: number[]) => void;
  /** Initial users to pre-populate when editing (optional) */
  initialUsers?: IAvailableUser[];
}

/**
 * Multi-select component for choosing team members from available users.
 *
 * Uses server-side search for scalability with large user bases.
 * Fetches available users from the API (excludes SYSTEM and DATABASE users).
 */
export const TeamMemberSelect = ({ selectedUserIds, onChange, initialUsers = [] }: ITeamMemberSelectProps) => {
  const biohubApi = useApi();

  // Track the search input value
  const [inputValue, setInputValue] = useState('');

  // Cache of selected user objects - persists across searches
  const [selectedUsersCache, setSelectedUsersCache] = useState<Map<number, IAvailableUser>>(
    () => new Map(initialUsers.map((u) => [u.system_user_id, u]))
  );

  // Load available users with search
  const usersDataLoader = useDataLoader((search?: string) => biohubApi.teams.getAvailableUsers(search));

  // Load initial results on mount
  useEffect(() => {
    usersDataLoader.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update cache when initialUsers changes (e.g., when editing different team)
  useEffect(() => {
    if (initialUsers.length > 0) {
      setSelectedUsersCache((prev) => {
        const newCache = new Map(prev);
        for (const user of initialUsers) {
          newCache.set(user.system_user_id, user);
        }
        return newCache;
      });
    }
  }, [initialUsers]);

  /**
   * Debounced function to search users.
   * Waits 300ms after last keystroke before triggering API call.
   */
  const debouncedSearch = useMemo(
    () =>
      debounce((term: string) => {
        usersDataLoader.refresh(term || undefined);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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

  // Merge search results with cached selected users to ensure selected users are always visible
  const availableOptions = useMemo(() => {
    const searchResults = usersDataLoader.data?.users ?? [];
    const optionsMap = new Map<number, IAvailableUser>();

    // Add all search results
    for (const user of searchResults) {
      optionsMap.set(user.system_user_id, user);
    }

    // Add cached selected users (ensures they appear even if not in search results)
    for (const userId of selectedUserIds) {
      const cachedUser = selectedUsersCache.get(userId);
      if (cachedUser && !optionsMap.has(userId)) {
        optionsMap.set(userId, cachedUser);
      }
    }

    return Array.from(optionsMap.values()).sort((a, b) => a.user_identifier.localeCompare(b.user_identifier));
  }, [usersDataLoader.data?.users, selectedUserIds, selectedUsersCache]);

  // Get selected user objects from IDs
  const selectedUsers = useMemo(
    () => availableOptions.filter((u) => selectedUserIds.includes(u.system_user_id)),
    [availableOptions, selectedUserIds]
  );

  /**
   * Handle selection changes - update cache and notify parent.
   */
  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: IAvailableUser[]) => {
      // Update cache with newly selected users
      setSelectedUsersCache((prev) => {
        const newCache = new Map(prev);
        for (const user of newValue) {
          newCache.set(user.system_user_id, user);
        }
        return newCache;
      });

      // Notify parent with user IDs
      onChange(newValue.map((u) => u.system_user_id));
    },
    [onChange]
  );

  return (
    <Autocomplete
      multiple
      options={availableOptions}
      value={selectedUsers}
      inputValue={inputValue}
      loading={usersDataLoader.isLoading}
      getOptionLabel={(user) => user.user_identifier}
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
              <Typography>{user.user_identifier}</Typography>
            </Box>
          </li>
        );
      }}
      getOptionKey={(user: IAvailableUser) => user.system_user_id}
    />
  );
};
