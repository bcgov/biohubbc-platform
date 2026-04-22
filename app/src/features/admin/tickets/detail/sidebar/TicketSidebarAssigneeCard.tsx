import { mdiDotsVertical, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { ContextMenuButton, IContextMenuItem } from 'components/ContextMenuButton';
import { TICKET_ASSIGNEE_STATUS_PRESENTATION } from 'constants/ticket';
import { ITicketAssignee, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';

interface ITicketSidebarAssigneeCardProps {
  assignee: ITicketAssignee;
  isSystemAdmin: boolean;
  isCurrentUserAssignment: boolean;
  onRemoveAssignee: (ticketSystemUserId: string) => Promise<void> | void;
  onUpdateAssigneeStatus: (ticketSystemUserId: string, status: TicketSystemUserStatus) => Promise<void> | void;
}

/**
 * Sidebar card row for a ticket assignee.
 *
 * Includes current-user request handling and context menu delete action.
 *
 * @param {ITicketSidebarAssigneeCardProps} props
 * @return {*}
 */
export const TicketSidebarAssigneeCard = (props: ITicketSidebarAssigneeCardProps) => {
  const { assignee, isSystemAdmin, isCurrentUserAssignment, onRemoveAssignee, onUpdateAssigneeStatus } = props;

  const statusOptions: { value: TicketSystemUserStatus; label: string; icon: string }[] = (
    Object.entries(TICKET_ASSIGNEE_STATUS_PRESENTATION) as Array<
      [TicketSystemUserStatus, (typeof TICKET_ASSIGNEE_STATUS_PRESENTATION)[TicketSystemUserStatus]]
    >
  ).map(([value, presentation]) => ({
    value,
    label: presentation.label,
    icon: presentation.icon
  }));

  const displayLabel = assignee.system_user.display_name ?? assignee.system_user.user_identifier;
  const canUpdateStatus = isSystemAdmin || isCurrentUserAssignment;
  const canDelete = isSystemAdmin;

  const statusContextMenuItems: IContextMenuItem[] = canUpdateStatus
    ? statusOptions.map((statusOption) => ({
        label: statusOption.label,
        icon: <Icon path={statusOption.icon} size={0.7} />,
        onClick: () => onUpdateAssigneeStatus(assignee.ticket_system_user_id, statusOption.value),
        disabled: statusOption.value === assignee.status
      }))
    : [];
  const deleteContextMenuItems: IContextMenuItem[] = canDelete
    ? [
        {
          label: 'Delete',
          icon: <Icon path={mdiTrashCanOutline} size={0.7} />,
          onClick: () => onRemoveAssignee(assignee.ticket_system_user_id)
        }
      ]
    : [];

  return (
    <Paper
      variant="outlined"
      sx={{
        bgcolor: 'grey.50',
        px: 2,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2
      }}>
      <Typography variant="body2">{displayLabel}</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          size="small"
          label={TICKET_ASSIGNEE_STATUS_PRESENTATION[assignee.status].label}
          color={TICKET_ASSIGNEE_STATUS_PRESENTATION[assignee.status].colour}
        />

        {statusContextMenuItems.length || deleteContextMenuItems.length ? (
          <ContextMenuButton
            buttonTitle={`assignee-${assignee.ticket_system_user_id}-menu`}
            buttonIcon={<Icon path={mdiDotsVertical} size={0.75} />}
            itemGroups={[
              { groupId: 'status-options', items: statusContextMenuItems },
              { groupId: 'danger-actions', items: deleteContextMenuItems }
            ]}
          />
        ) : null}
      </Box>
    </Paper>
  );
};
