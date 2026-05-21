import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
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

  return (
    <TicketSidebarSection label="Assignees" onAdd={onOpenDialog}>
      <LoadingGuard
        hasNoData={!ticketSystemUsers.length}
        hasNoDataFallback={
          <Typography variant="body2" color="textSecondary">
            No assignees
          </Typography>
        }>
        <Stack spacing={1}>
          {ticketSystemUsers.map((ticketSystemUser) => (
            <TicketSidebarSystemUserCard
              key={ticketSystemUser.ticket_system_user_id}
              ticketSystemUser={ticketSystemUser}
              onRemoveTicketSystemUser={onRemoveTicketSystemUser}
              onUpdateTicketSystemUserStatus={onUpdateTicketSystemUserStatus}
            />
          ))}
        </Stack>
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
