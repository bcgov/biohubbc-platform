import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { LabelledCard } from 'components/card/LabelledCard';
import { SearchAutocomplete } from 'features/search/result/sidebar/search/components/section/autocomplete/SearchAutocomplete';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';

export interface ITeamFormUser {
  id: string;
  label: string;
}

interface ITeamFormProps {
  options: SidebarOption[];
  isLoading: boolean;
  users: ITeamFormUser[];
  isSubmitting: boolean;
  onSearch: (search: string) => void;
  onSelectUser: (option: SidebarOption | null) => void;
  onRemoveUser: (userId: string) => void;
}

/**
 * Reusable team/user selection form with search and removable selected users.
 *
 * @param {ITeamFormProps} props
 * @return {*}
 */
export const TeamForm = (props: ITeamFormProps) => {
  const { options, isLoading, users, isSubmitting, onSearch, onSelectUser, onRemoveUser } = props;

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <SearchAutocomplete
        options={options}
        value={null}
        size="medium"
        placeholder="Search users to add"
        loading={isLoading}
        disabled={isSubmitting}
        onInputChange={onSearch}
        onChange={onSelectUser}
      />

      <Stack spacing={1.25}>
        {users.map((user) => (
          <LabelledCard
            key={user.id}
            label={user.label}
            action={
              <IconButton
                size="small"
                aria-label={`remove ${user.label}`}
                onClick={() => onRemoveUser(user.id)}
                disabled={isSubmitting}>
                <Icon path={mdiClose} size={0.65} />
              </IconButton>
            }
          />
        ))}
      </Stack>
    </Stack>
  );
};
