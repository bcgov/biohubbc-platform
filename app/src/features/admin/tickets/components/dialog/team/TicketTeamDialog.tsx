import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { OkDialog } from 'components/dialog/OkDialog';
import { TeamForm } from 'components/form/TeamForm';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { userQueryKeys } from 'utils/query-keys/user-query-keys';
import { getUserLabel } from 'utils/Utils';
import { useAddTeamMemberMutation } from '../../../hooks/useAddTeamMemberMutation';
import { useRemoveTeamMemberMutation } from '../../../hooks/useRemoveTeamMemberMutation';

interface ITicketTeamDialogProps {
  open: boolean;
  teamId: string;
  members: ITeamMember[];
  onClose: () => void;
}

/**
 * Dialog for managing ticket participants. Additions and removals are written to the team members query, which the
 * sidebar reads too.
 *
 * @param {ITicketTeamDialogProps} props
 * @return {*}
 */
export const TicketTeamDialog = (props: ITicketTeamDialogProps) => {
  const { open, teamId, members, onClose } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const addMemberMutation = useAddTeamMemberMutation();
  const removeMemberMutation = useRemoveTeamMemberMutation();
  const { mutate: addMember } = addMemberMutation;
  const { mutate: removeMember } = removeMemberMutation;
  const [userSearch, setUserSearch] = useState('');

  const availableUsersQuery = useQuery({
    queryKey: userQueryKeys.available(userSearch),
    queryFn: ({ signal }) => api.teams.getAvailableUsers(userSearch, { signal }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const { error: availableUsersError } = availableUsersQuery;
  useEffect(() => {
    if (availableUsersError) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: availableUsersError.message });
    }
  }, [availableUsersError, dialogContext]);

  const debouncedUserSearch = useDebounce(setUserSearch, 300);

  const availableUsers = useMemo(() => availableUsersQuery.data?.users ?? [], [availableUsersQuery.data?.users]);
  const userOptions = useMemo<SearchOption[]>(
    () =>
      availableUsers.map((user) => ({
        value: user.system_user_id,
        label: getUserLabel(user)
      })),
    [availableUsers]
  );

  const memberSystemUserIds = useMemo(() => new Set(members.map((member) => member.system_user_id)), [members]);

  const handleSelectUser = useCallback(
    (option: SearchOption | null) => {
      if (!option) {
        return;
      }

      const selectedUserId = Number(option.value);

      // User already exists in the team - return early
      if (memberSystemUserIds.has(selectedUserId)) {
        return;
      }

      const user = availableUsers.find((availableUser) => availableUser.system_user_id === selectedUserId) ?? {
        system_user_id: selectedUserId,
        user_identifier: option.label,
        display_name: null
      };

      addMember({ teamId, user });
    },
    [addMember, availableUsers, memberSystemUserIds, teamId]
  );

  const handleRemoveUser = useCallback(
    (teamMemberId: string) => removeMember({ teamId, teamMemberId }),
    [removeMember, teamId]
  );

  const users = useMemo(
    () =>
      members.map((member) => ({
        id: member.team_member_id,
        label: getUserLabel(member)
      })),
    [members]
  );

  const isSubmitting = addMemberMutation.isPending || removeMemberMutation.isPending;

  return (
    <OkDialog
      open={open}
      onClose={onClose}
      dialogTitle="Participants"
      dialogText=""
      okButtonLabel="Done"
      okButtonProps={{ size: 'large', disabled: isSubmitting }}
      dialogProps={{ fullWidth: true, maxWidth: 'md' }}
      dialogContent={
        <TeamForm
          options={userOptions}
          isLoading={availableUsersQuery.isFetching}
          users={users}
          isSubmitting={isSubmitting}
          onSearch={debouncedUserSearch}
          onSelectUser={handleSelectUser}
          onRemoveUser={handleRemoveUser}
        />
      }
    />
  );
};
