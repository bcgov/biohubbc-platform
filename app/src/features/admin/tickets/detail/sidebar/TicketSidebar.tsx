import Stack from '@mui/material/Stack';
import { skipToken, useQuery } from '@tanstack/react-query';
import { TicketSystemUserDialog } from 'features/admin/tickets/components/dialog/system-user/TicketSystemUserDialog';
import { TicketTeamDialog } from 'features/admin/tickets/components/dialog/team/TicketTeamDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { teamQueryKeys } from 'utils/query-keys/team-query-keys';
import { useRemoveTeamMemberMutation } from '../../hooks/useRemoveTeamMemberMutation';
import { useRemoveTicketSystemUserMutation } from '../../hooks/useRemoveTicketSystemUserMutation';
import { useTicketQuery } from '../../hooks/useTicketQuery';
import { useUpdateTicketSystemUserStatusMutation } from '../../hooks/useUpdateTicketSystemUserStatusMutation';
import { TicketSidebarSystemUsers } from './TicketSidebarSystemUsers';
import { TicketSidebarDataRequests } from './TicketSidebarDataRequests';
import { TicketSidebarReferences } from './TicketSidebarReferences';
import { TicketSidebarTeam } from './TicketSidebarTeam';
import { TicketSidebarUploads } from './TicketSidebarUploads';

/**
 * Renders the team sidebar for ticket context.
 *
 * @return {*}
 */
export const TicketSidebar = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const ticket = useTicketQuery().data;
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [isTicketSystemUserDialogOpen, setIsTicketSystemUserDialogOpen] = useState(false);
  const removeTeamMemberMutation = useRemoveTeamMemberMutation();
  const updateSystemUserStatusMutation = useUpdateTicketSystemUserStatusMutation();
  const removeSystemUserMutation = useRemoveTicketSystemUserMutation();

  const teamId = ticket?.team_id;
  const teamMembersQuery = useQuery({
    queryKey: teamQueryKeys.members(teamId ?? ''),
    queryFn: teamId ? ({ signal }) => api.teams.getTeamMembers(teamId, { signal }) : skipToken
  });

  const members = teamMembersQuery.data?.members ?? [];

  if (!ticket) {
    return null;
  }

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
      onYes: () => {
        closeTicketSystemUserDeleteDialog();
        removeSystemUserMutation.mutate(ticketSystemUserId);
      }
    });
  };

  return (
    <Stack spacing={5}>
      <TicketSidebarSystemUsers
        ticketSystemUsers={ticket.ticket_system_users}
        onOpenDialog={() => setIsTicketSystemUserDialogOpen(true)}
        onUpdateTicketSystemUserStatus={(ticketSystemUserId: string, status: TicketSystemUserStatus) =>
          updateSystemUserStatusMutation.mutate({ ticketSystemUserId, status })
        }
        onRemoveTicketSystemUser={handleConfirmRemoveTicketSystemUser}
      />
      <TicketSidebarTeam
        members={members}
        isLoading={teamMembersQuery.isFetching}
        onOpenDialog={() => setIsParticipantsDialogOpen(true)}
        onRemoveUser={(teamMemberId: string) =>
          removeTeamMemberMutation.mutate({ teamId: ticket.team_id, teamMemberId })
        }
      />
      <TicketSidebarDataRequests />
      <TicketSidebarUploads />
      <TicketSidebarReferences />

      <TicketTeamDialog
        open={isParticipantsDialogOpen}
        teamId={ticket.team_id}
        members={members}
        onClose={() => setIsParticipantsDialogOpen(false)}
      />
      <TicketSystemUserDialog
        open={isTicketSystemUserDialogOpen}
        onClose={() => setIsTicketSystemUserDialogOpen(false)}
      />
    </Stack>
  );
};
