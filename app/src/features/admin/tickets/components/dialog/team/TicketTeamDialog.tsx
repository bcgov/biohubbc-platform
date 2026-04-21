import { OkDialog } from 'components/dialog/OkDialog';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketTeamForm } from './form/TicketTeamForm';

interface ITicketTeamDialogProps {
  open: boolean;
  teamId?: string;
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

  const availableUsersLoader = useDataLoader(
    (search?: string) => api.teams.getAvailableUsers(search),
    (error) => showApiError(error)
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    availableUsersLoader.load();
  }, [open, availableUsersLoader]);

  const debouncedAvailableUserRefresh = useDebounce((search: string) => {
    availableUsersLoader.refresh(search);
  }, 300);

  const handleAvailableUserSearch = useCallback(
    (search: string) => {
      debouncedAvailableUserRefresh(search);
    },
    [debouncedAvailableUserRefresh]
  );

  const userOptions = useMemo<SidebarOption[]>(
    () =>
      (availableUsersLoader.data?.users ?? []).map((user) => ({
        value: user.system_user_id,
        label: user.user_identifier
      })),
    [availableUsersLoader.data?.users]
  );

  const memberSystemUserIds = useMemo(() => new Set(members.map((member) => member.system_user_id)), [members]);

  const handleSelectUser = useCallback(
    async (option: SidebarOption | null) => {
      if (!teamId || !option) {
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

  const handleRemoveParticipant = useCallback(
    async (teamMemberId: string) => {
      if (!teamId) {
        return;
      }

      const removedMember = members.find((member) => member.team_member_id === teamMemberId);

      try {
        setIsSubmitting(true);
        onMemberRemove(teamMemberId);
        await api.teams.deleteTeamMember(teamId, teamMemberId);
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
        <TicketTeamForm
          options={userOptions}
          isLoading={availableUsersLoader.isLoading}
          members={members}
          isSubmitting={isSubmitting}
          onSearch={handleAvailableUserSearch}
          onSelectUser={handleSelectUser}
          onRemoveParticipant={handleRemoveParticipant}
        />
      }
    />
  );
};
