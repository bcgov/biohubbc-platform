import Stack from '@mui/material/Stack';
import { TicketTeamDialog } from 'features/admin/tickets/components/dialog/team/TicketTeamDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { ITicketReference } from 'interfaces/useTicketsApi.interface';
import { useEffect, useState } from 'react';
import { TicketSidebarReferences } from './TicketSidebarReferences';
import { TicketSidebarSection } from './TicketSidebarSection';
import { TicketSidebarTeam } from './TicketSidebarTeam';

interface ITicketSidebarProps {
  teamId?: string;
  references?: ITicketReference[];
}

/**
 * Renders the team sidebar for ticket context.
 *
 * @param {ITicketSidebarProps} props
 * @return {*}
 */
export const TicketSidebar = (props: ITicketSidebarProps) => {
  const { teamId, references } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const [isAssigneesDialogOpen, setIsAssigneesDialogOpen] = useState(false);

  const teamMembersLoader = useDataLoader((currentTeamId: string) => api.teams.getTeamMembers(currentTeamId));

  useEffect(() => {
    if (!teamId) {
      return;
    }

    teamMembersLoader.load(teamId);
  }, [teamId, teamMembersLoader]);

  const members = teamMembersLoader.data?.members ?? [];

  // Optimistically insert a member into local state unless already present.
  const handleMemberAdd = (member: ITeamMember) => {
    const currentData = teamMembersLoader.data;

    if (!currentData) {
      return;
    }

    const existingMembers = currentData.members;
    const existingMemberIds = new Set(existingMembers.map((existingMember) => existingMember.team_member_id));
    const nextMembers = existingMemberIds.has(member.team_member_id) ? existingMembers : [...existingMembers, member];

    teamMembersLoader.setData({
      ...currentData,
      members: nextMembers
    });
  };

  // Remove a member from local state by id.
  const handleMemberRemove = (teamMemberId: string) => {
    const currentData = teamMembersLoader.data;

    if (!currentData) {
      return;
    }

    teamMembersLoader.setData({
      ...currentData,
      members: currentData.members.filter((existingMember) => existingMember.team_member_id !== teamMemberId)
    });
  };

  // Optimistically remove, persist deletion, and rollback if API delete fails.
  const handleRemoveAssignee = async (teamMemberId: string) => {
    if (!teamId) {
      return;
    }

    const removedMember = members.find((member) => member.team_member_id === teamMemberId);

    try {
      handleMemberRemove(teamMemberId);
      await api.teams.deleteTeamMember(teamId, teamMemberId);
    } catch (error) {
      if (removedMember) {
        handleMemberAdd(removedMember);
      }

      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    }
  };

  return (
    <Stack spacing={5}>
      <TicketSidebarTeam
        members={members}
        isLoading={teamMembersLoader.isLoading}
        onOpenDialog={() => setIsAssigneesDialogOpen(true)}
        onRemoveAssignee={handleRemoveAssignee}
      />
      <TicketSidebarSection label="Data Requests" />
      <TicketSidebarSection label="Uploads" />
      <TicketSidebarReferences references={references ?? []} />

      <TicketTeamDialog
        open={isAssigneesDialogOpen}
        teamId={teamId}
        members={members}
        onClose={() => setIsAssigneesDialogOpen(false)}
        onMemberAdd={handleMemberAdd}
        onMemberRemove={handleMemberRemove}
      />
    </Stack>
  );
};
