import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SYSTEM_ROLE } from 'constants/roles';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { ITicketAssignee, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { TicketSidebarAssigneeCard } from './TicketSidebarAssigneeCard';
import { TicketSidebarSection } from './TicketSidebarSection';

interface ITicketSidebarAssigneesProps {
  assignees: ITicketAssignee[];
  onOpenDialog: () => void;
  onRemoveAssignee: (ticketSystemUserId: string) => Promise<void> | void;
  onUpdateAssigneeStatus: (ticketSystemUserId: string, status: TicketSystemUserStatus) => Promise<void> | void;
}

/**
 * Assignees section backed by ticket_system_user.
 *
 * @param {ITicketSidebarAssigneesProps} props
 * @return {*}
 */
export const TicketSidebarAssignees = (props: ITicketSidebarAssigneesProps) => {
  const { assignees, onOpenDialog, onRemoveAssignee, onUpdateAssigneeStatus } = props;
  const { biohubUserWrapper } = useAuthStateContext();

  const currentSystemUserId = biohubUserWrapper.systemUserId;
  const isSystemAdmin = biohubUserWrapper.roleNames?.includes(SYSTEM_ROLE.SYSTEM_ADMIN) ?? false;

  return (
    <TicketSidebarSection label="Assignees" onAdd={isSystemAdmin ? onOpenDialog : undefined}>
      <LoadingGuard
        hasNoData={!assignees.length}
        hasNoDataFallback={
          <Typography variant="body2" color="textSecondary">
            No assignees
          </Typography>
        }>
        <Stack spacing={1.25}>
          {assignees.map((assignee) => {
            const isCurrentUserAssignment = currentSystemUserId === assignee.system_user_id;
            return (
              <TicketSidebarAssigneeCard
                key={assignee.ticket_system_user_id}
                assignee={assignee}
                isSystemAdmin={isSystemAdmin}
                isCurrentUserAssignment={isCurrentUserAssignment}
                onRemoveAssignee={onRemoveAssignee}
                onUpdateAssigneeStatus={onUpdateAssigneeStatus}
              />
            );
          })}
        </Stack>
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
