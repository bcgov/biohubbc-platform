import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { LabelledCard } from 'components/card/LabelledCard';
import { SearchAutocomplete } from 'features/search/result/sidebar/search/components/section/autocomplete/SearchAutocomplete';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';

interface ITicketTeamFormProps {
  options: SidebarOption[];
  isLoading: boolean;
  members: ITeamMember[];
  isSubmitting: boolean;
  onSearch: (search: string) => void;
  onSelectUser: (option: SidebarOption | null) => void;
  onRemoveAssignee: (teamMemberId: string) => void;
}

/**
 * Form content for managing ticket assignees.
 *
 * @param {ITicketTeamFormProps} props
 * @return {*}
 */
export const TicketTeamForm = (props: ITicketTeamFormProps) => {
  const { options, isLoading, members, isSubmitting, onSearch, onSelectUser, onRemoveAssignee } = props;

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
        {members.map((member) => (
          <LabelledCard
            key={member.team_member_id}
            label={member.user_identifier}
            action={
              <IconButton
                size="small"
                aria-label={`remove ${member.user_identifier}`}
                onClick={() => onRemoveAssignee(member.team_member_id)}
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
