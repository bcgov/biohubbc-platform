import { TeamForm } from 'components/form/TeamForm';
import { OkDialog } from 'components/dialog/OkDialog';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ITicketTeamDialogProps {
  open: boolean;
  teamId: string;
  members: ITeamMember[];
  onClose: () => void;
  onMemberAdd: (member: ITeamMember) => void;
  onMemberRemove: (teamMemberId: string) => void;
}

/**
 * Dialog for managing ticket participants.
 *
 * @param {ITicketTeamDialogProps} props
 * @return {*}
 */
export const TicketTeamDialog = (props: ITicketTeamDialogProps) => {
  const { open, teamId, members, onClose, onMemberAdd, onMemberRemove } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showApiError = useCallback(
    (error: unknown) => {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    },
    [dialogContext]
  );

  const availableUsersLoader = useDataLoader((search?: string) => api.teams.getAvailableUsers(search), showApiError);

  useEffect(() => {
    if (!open) {
      return;
    }

    availableUsersLoader.load();
  }, [open, availableUsersLoader]);

  const debouncedAvailableUserRefresh = useDebounce((search: string) => {
    availableUsersLoader.refresh(search);
  }, 300);

  const availableUsers = useMemo(() => availableUsersLoader.data?.users ?? [], [availableUsersLoader.data?.users]);
  const userOptions = useMemo<SidebarOption[]>(
    () =>
      availableUsers.map((user) => ({
        value: user.system_user_id,
        label: user.user_identifier
      })),
    [availableUsers]
  );

  const memberSystemUserIds = useMemo(() => new Set(members.map((member) => member.system_user_id)), [members]);

  const handleSelectUser = useCallback(
    async (option: SidebarOption | null) => {
      if (!option) {
        return;
      }

      const selectedUserId = Number(option.value);

      // User already exists in the team - return early
      if (memberSystemUserIds.has(selectedUserId)) {
        return;
      }

      const optimisticTeamMemberId = `optimistic-${selectedUserId}-${Date.now()}`;
      const optimisticMember: ITeamMember = {
        team_member_id: optimisticTeamMemberId,
        system_user_id: selectedUserId,
        user_identifier: option.label
      };

      try {
        setIsSubmitting(true);
        onMemberAdd(optimisticMember);

        const createdMember = await api.teams.createTeamMember(teamId, selectedUserId);

        onMemberRemove(optimisticTeamMemberId);
        onMemberAdd(createdMember);
      } catch (error) {
        onMemberRemove(optimisticTeamMemberId);
        showApiError(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api.teams, memberSystemUserIds, onMemberAdd, onMemberRemove, showApiError, teamId]
  );

  const handleRemoveUser = useCallback(
    async (userId: string) => {
      const removedMember = members.find((member) => member.team_member_id === userId);

      try {
        setIsSubmitting(true);
        onMemberRemove(userId);
        await api.teams.deleteTeamMember(teamId, userId);
      } catch (error) {
        if (removedMember) {
          onMemberAdd(removedMember);
        }
        showApiError(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api.teams, members, onMemberAdd, onMemberRemove, showApiError, teamId]
  );

  const users = useMemo(
    () =>
      members.map((member) => ({
        id: member.team_member_id,
        label: member.user_identifier
      })),
    [members]
  );

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
          isLoading={availableUsersLoader.isLoading}
          users={users}
          isSubmitting={isSubmitting}
          onSearch={debouncedAvailableUserRefresh}
          onSelectUser={handleSelectUser}
          onRemoveUser={handleRemoveUser}
        />
      }
    />
  );
};
