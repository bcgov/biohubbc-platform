import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SYSTEM_ROLE } from 'constants/roles';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { ITicketSystemUser, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { TicketSidebarSystemUserCard } from './TicketSidebarSystemUserCard';
import { TicketSidebarSection } from './TicketSidebarSection';

interface ITicketSidebarSystemUsersProps {
  ticketSystemUsers: ITicketSystemUser[];
  onOpenDialog: () => void;
  onRemoveTicketSystemUser: (ticketSystemUserId: string) => Promise<void> | void;
  onUpdateTicketSystemUserStatus: (ticketSystemUserId: string, status: TicketSystemUserStatus) => Promise<void> | void;
}

/**
 * Ticket system users section backed by ticket_system_user.
 *
 * @param {ITicketSidebarSystemUsersProps} props
 * @return {*}
 */
export const TicketSidebarSystemUsers = (props: ITicketSidebarSystemUsersProps) => {
  const { ticketSystemUsers, onOpenDialog, onRemoveTicketSystemUser, onUpdateTicketSystemUserStatus } = props;
  const { biohubUserWrapper } = useAuthStateContext();

  const currentSystemUserId = biohubUserWrapper.systemUserId;
  const isSystemAdmin = biohubUserWrapper.roleNames?.includes(SYSTEM_ROLE.SYSTEM_ADMIN) ?? false;

  return (
    <TicketSidebarSection label="Assignees" onAdd={isSystemAdmin ? onOpenDialog : undefined}>
      <LoadingGuard
        hasNoData={!ticketSystemUsers.length}
        hasNoDataFallback={
          <Typography variant="body2" color="textSecondary">
            No assignees
          </Typography>
        }>
        <Stack spacing={1}>
          {ticketSystemUsers.map((ticketSystemUser) => {
            const isCurrentUserAssignment = currentSystemUserId === ticketSystemUser.system_user_id;
            return (
              <TicketSidebarSystemUserCard
                key={ticketSystemUser.ticket_system_user_id}
                ticketSystemUser={ticketSystemUser}
                isSystemAdmin={isSystemAdmin}
                isCurrentUserAssignment={isCurrentUserAssignment}
                onRemoveTicketSystemUser={onRemoveTicketSystemUser}
                onUpdateTicketSystemUserStatus={onUpdateTicketSystemUserStatus}
              />
            );
          })}
        </Stack>
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
