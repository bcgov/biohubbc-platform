import { OkDialog } from 'components/dialog/OkDialog';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import useDataLoader from 'hooks/useDataLoader';
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
 * Dialog for managing ticket assignees.
 *
 * @param {ITicketTeamDialogProps} props
 * @return {*}
 */
export const TicketTeamDialog = (props: ITicketTeamDialogProps) => {
  const { open, teamId, members, onClose, onMemberAdd, onMemberRemove } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableUsersLoader = useDataLoader((search?: string) => api.teams.getAvailableUsers(search));

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

  const handleSelectUser = async (option: SidebarOption | null) => {
    if (!teamId || !option?.value) {
      return;
    }

    const selectedUserId = Number(option.value);

    if (members.some((member) => member.system_user_id === selectedUserId)) {
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
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAssignee = async (teamMemberId: string) => {
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
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OkDialog
      open={open}
      onClose={onClose}
      dialogTitle="Assignees"
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
          onRemoveAssignee={handleRemoveAssignee}
        />
      }
    />
  );
};
