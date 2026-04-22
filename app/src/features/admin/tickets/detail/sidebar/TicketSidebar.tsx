import Stack from '@mui/material/Stack';
import { TicketAssigneeDialog } from 'features/admin/tickets/components/dialog/assignee/TicketAssigneeDialog';
import { TicketTeamDialog } from 'features/admin/tickets/components/dialog/team/TicketTeamDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useOptimisticDataLoader } from 'hooks/useOptimisticDataLoader';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { ITicketAssignee, ITicketReference, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { useEffect, useState } from 'react';
import { TicketSidebarAssignees } from './TicketSidebarAssignees';
import { TicketSidebarDataRequests } from './TicketSidebarDataRequests';
import { TicketSidebarReferences } from './TicketSidebarReferences';
import { TicketSidebarTeam } from './TicketSidebarTeam';
import { TicketSidebarUploads } from './TicketSidebarUploads';

interface ITicketSidebarProps {
  ticketId?: string;
  teamId?: string;
  assignees?: ITicketAssignee[];
  references?: ITicketReference[];
  dataRequests?: DataRequestResponse[];
}

/**
 * Renders the team sidebar for ticket context.
 *
 * @param {ITicketSidebarProps} props
 * @return {*}
 */
export const TicketSidebar = (props: ITicketSidebarProps) => {
  const { ticketId, teamId, assignees, references, dataRequests } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [isAssigneeDialogOpen, setIsAssigneeDialogOpen] = useState(false);

  const teamMembersLoader = useDataLoader((currentTeamId: string) => api.teams.getTeamMembers(currentTeamId));
  const optimisticTeamMembersLoader = useOptimisticDataLoader(teamMembersLoader);
  const optimisticTicketLoader = useOptimisticDataLoader(ticketDataLoader);

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
      teamMembersLoader.setData({ members: [member] });
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
  const handleRemoveUser = async (teamMemberId: string) => {
    if (!teamId) {
      return;
    }

    await optimisticTeamMembersLoader.refresh((currentData) => ({
      optimisticState: {
        ...currentData,
        members: currentData.members.filter((member) => member.team_member_id !== teamMemberId)
      },
      mutation: () => api.teams.deleteTeamMember(teamId, teamMemberId),
      onRollback: (error) => {
        const apiError = error as APIError;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: apiError.message
        });
      }
    }));
  };

  /**
   * Updates a ticket assignee status without refetching ticket detail.
   *
   * Persists the status change through the API, then patches local ticket
   * context state so assignees update immediately in the sidebar.
   *
   * @param {string} ticketSystemUserId
   * @param {TicketSystemUserStatus} status
   * @return {Promise<void>}
   */
  const handleUpdateAssigneeStatus = async (
    ticketSystemUserId: string,
    status: TicketSystemUserStatus
  ): Promise<void> => {
    if (!ticketId) {
      return;
    }

    await optimisticTicketLoader.refresh((currentTicket) => ({
      optimisticState: {
        ...currentTicket,
        assignees: currentTicket.assignees.map((assignee) =>
          assignee.ticket_system_user_id === ticketSystemUserId ? { ...assignee, status } : assignee
        )
      },
      mutation: () => api.tickets.updateTicketAssigneeStatus(ticketId, ticketSystemUserId, { status }),
      onRollback: (error) => {
        const apiError = error as APIError;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: apiError.message
        });
      }
    }));
  };

  /**
   * Soft deletes a ticket assignee without refetching ticket detail.
   *
   * Calls the delete endpoint, then removes the assignee from local ticket
   * context state to keep UI in sync.
   *
   * @param {string} ticketSystemUserId
   * @return {Promise<void>}
   */
  const handleRemoveAssignee = async (ticketSystemUserId: string): Promise<void> => {
    if (!ticketId) {
      return;
    }

    await optimisticTicketLoader.refresh((currentTicket) => ({
      optimisticState: {
        ...currentTicket,
        assignees: currentTicket.assignees.filter((assignee) => assignee.ticket_system_user_id !== ticketSystemUserId)
      },
      mutation: () => api.tickets.deleteTicketAssignee(ticketId, ticketSystemUserId),
      onRollback: (error) => {
        const apiError = error as APIError;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: apiError.message
        });
      }
    }));
  };

  /**
   * Closes the assignee delete confirmation dialog.
   *
   * @return {void}
   */
  const closeAssigneeDeleteDialog = (): void => {
    dialogContext.setYesNoDialog({ open: false });
  };

  /**
   * Opens a confirmation dialog before deleting a ticket assignee.
   *
   * @param {string} ticketSystemUserId
   * @return {void}
   */
  const handleConfirmRemoveAssignee = (ticketSystemUserId: string): void => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Remove Assignee',
      dialogText: 'Are you sure you want to remove this assignee?',
      yesButtonLabel: 'Remove',
      noButtonLabel: 'Cancel',
      onClose: closeAssigneeDeleteDialog,
      onNo: closeAssigneeDeleteDialog,
      onYes: async () => {
        closeAssigneeDeleteDialog();
        await handleRemoveAssignee(ticketSystemUserId);
      }
    });
  };

  return (
    <Stack spacing={5}>
      <TicketSidebarAssignees
        assignees={assignees ?? []}
        onOpenDialog={() => setIsAssigneeDialogOpen(true)}
        onUpdateAssigneeStatus={handleUpdateAssigneeStatus}
        onRemoveAssignee={handleConfirmRemoveAssignee}
      />
      <TicketSidebarTeam
        members={members}
        isLoading={teamMembersLoader.isLoading}
        onOpenDialog={() => setIsParticipantsDialogOpen(true)}
        onRemoveUser={handleRemoveUser}
      />
      <TicketSidebarDataRequests dataRequests={dataRequests ?? []} />
      <TicketSidebarUploads />
      <TicketSidebarReferences references={references ?? []} />

      <TicketTeamDialog
        open={isParticipantsDialogOpen}
        teamId={teamId}
        members={members}
        onClose={() => setIsParticipantsDialogOpen(false)}
        onMemberAdd={handleMemberAdd}
        onMemberRemove={handleMemberRemove}
      />
      {ticketId ? (
        <TicketAssigneeDialog
          open={isAssigneeDialogOpen}
          ticketId={ticketId}
          onClose={() => setIsAssigneeDialogOpen(false)}
        />
      ) : null}
    </Stack>
  );
};
