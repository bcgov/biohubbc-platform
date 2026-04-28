import Stack from '@mui/material/Stack';
import { TicketSystemUserDialog } from 'features/admin/tickets/components/dialog/system-user/TicketSystemUserDialog';
import { TicketTeamDialog } from 'features/admin/tickets/components/dialog/team/TicketTeamDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useOptimisticDataLoader } from 'hooks/useOptimisticDataLoader';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { ITicketSystemUser, ITicketReference, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { useEffect, useState } from 'react';
import { TicketSidebarSystemUsers } from './TicketSidebarSystemUsers';
import { TicketSidebarDataRequests } from './TicketSidebarDataRequests';
import { TicketSidebarReferences } from './TicketSidebarReferences';
import { TicketSidebarTeam } from './TicketSidebarTeam';
import { TicketSidebarUploads } from './TicketSidebarUploads';

interface ITicketSidebarProps {
  ticketId: string;
  teamId: string;
  ticketSystemUsers: ITicketSystemUser[];
  references: ITicketReference[];
  dataRequests: DataRequestResponse[];
}

/**
 * Renders the team sidebar for ticket context.
 *
 * @param {ITicketSidebarProps} props
 * @return {*}
 */
export const TicketSidebar = (props: ITicketSidebarProps) => {
  const { ticketId, teamId, ticketSystemUsers, references, dataRequests } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [isTicketSystemUserDialogOpen, setIsTicketSystemUserDialogOpen] = useState(false);

  const teamMembersLoader = useDataLoader((currentTeamId: string) => api.teams.getTeamMembers(currentTeamId));
  const optimisticTeamMembersLoader = useOptimisticDataLoader(teamMembersLoader);
  const optimisticTicketLoader = useOptimisticDataLoader(ticketDataLoader);
  const showApiErrorSnackbar = (error: unknown) => {
    const apiError = error as APIError;
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: apiError.message
    });
  };

  useEffect(() => {
    teamMembersLoader.load(teamId);
  }, [teamId, teamMembersLoader]);

  const members = teamMembersLoader.data?.members ?? [];

  // Optimistically insert a member into local state unless already present.
  const handleMemberAdd = (member: ITeamMember) => {
    const currentData = teamMembersLoader.data ?? { members: [] };
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
    await optimisticTeamMembersLoader.refresh((currentData) => ({
      optimisticState: {
        ...currentData,
        members: currentData.members.filter((member) => member.team_member_id !== teamMemberId)
      },
      mutation: () => api.teams.deleteTeamMember(teamId, teamMemberId),
      onRollback: showApiErrorSnackbar
    }));
  };

  /**
   * Updates a ticket system user status without refetching ticket detail.
   *
   * Persists the status change through the API, then patches local ticket
   * context state so ticket system users update immediately in the sidebar.
   *
   * @param {string} ticketSystemUserId
   * @param {TicketSystemUserStatus} status
   * @return {Promise<void>}
   */
  const handleUpdateTicketSystemUserStatus = async (
    ticketSystemUserId: string,
    status: TicketSystemUserStatus
  ): Promise<void> => {
    await optimisticTicketLoader.refresh((currentTicket) => {
      const currentTicketSystemUsers = currentTicket.ticket_system_users ?? [];

      return {
        optimisticState: {
          ...currentTicket,
          ticket_system_users: currentTicketSystemUsers.map((ticketSystemUser) =>
            ticketSystemUser.ticket_system_user_id === ticketSystemUserId
              ? { ...ticketSystemUser, status }
              : ticketSystemUser
          )
        },
        mutation: () => api.tickets.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, { status }),
        onRollback: showApiErrorSnackbar
      };
    });
  };

  /**
   * Soft deletes a ticket system user without refetching ticket detail.
   *
   * Calls the delete endpoint, then removes the ticket system user from local ticket
   * context state to keep UI in sync.
   *
   * @param {string} ticketSystemUserId
   * @return {Promise<void>}
   */
  const handleRemoveTicketSystemUser = async (ticketSystemUserId: string): Promise<void> => {
    await optimisticTicketLoader.refresh((currentTicket) => {
      const currentTicketSystemUsers = currentTicket.ticket_system_users ?? [];

      return {
        optimisticState: {
          ...currentTicket,
          ticket_system_users: currentTicketSystemUsers.filter(
            (ticketSystemUser) => ticketSystemUser.ticket_system_user_id !== ticketSystemUserId
          )
        },
        mutation: () => api.tickets.deleteTicketSystemUser(ticketId, ticketSystemUserId),
        onRollback: showApiErrorSnackbar
      };
    });
  };

  /**
   * Closes the ticket system user delete confirmation dialog.
   *
   * @return {void}
   */
  const closeTicketSystemUserDeleteDialog = (): void => {
    dialogContext.setYesNoDialog({ open: false });
  };

  /**
   * Opens a confirmation dialog before deleting a ticket system user.
   *
   * @param {string} ticketSystemUserId
   * @return {void}
   */
  const handleConfirmRemoveTicketSystemUser = (ticketSystemUserId: string): void => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Remove User',
      dialogText: 'Are you sure you want to remove this user?',
      yesButtonLabel: 'Remove',
      noButtonLabel: 'Cancel',
      onClose: closeTicketSystemUserDeleteDialog,
      onNo: closeTicketSystemUserDeleteDialog,
      onYes: async () => {
        closeTicketSystemUserDeleteDialog();
        await handleRemoveTicketSystemUser(ticketSystemUserId);
      }
    });
  };

  return (
    <Stack spacing={5}>
      <TicketSidebarSystemUsers
        ticketSystemUsers={ticketSystemUsers}
        onOpenDialog={() => setIsTicketSystemUserDialogOpen(true)}
        onUpdateTicketSystemUserStatus={handleUpdateTicketSystemUserStatus}
        onRemoveTicketSystemUser={handleConfirmRemoveTicketSystemUser}
      />
      <TicketSidebarTeam
        members={members}
        isLoading={teamMembersLoader.isLoading}
        onOpenDialog={() => setIsParticipantsDialogOpen(true)}
        onRemoveUser={handleRemoveUser}
      />
      <TicketSidebarDataRequests dataRequests={dataRequests} />
      <TicketSidebarUploads />
      <TicketSidebarReferences references={references} />

      <TicketTeamDialog
        open={isParticipantsDialogOpen}
        teamId={teamId}
        members={members}
        onClose={() => setIsParticipantsDialogOpen(false)}
        onMemberAdd={handleMemberAdd}
        onMemberRemove={handleMemberRemove}
      />
      <TicketSystemUserDialog
        open={isTicketSystemUserDialogOpen}
        ticketId={ticketId}
        onClose={() => setIsTicketSystemUserDialogOpen(false)}
      />
    </Stack>
  );
};
