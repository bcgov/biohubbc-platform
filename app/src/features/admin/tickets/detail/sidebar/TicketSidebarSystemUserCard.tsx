import { mdiDotsVertical, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { ContextMenuButton, IContextMenuItem } from 'components/ContextMenuButton';
import { TICKET_SYSTEM_USER_STATUS_PRESENTATION } from 'constants/ticket';
import { ITicketSystemUser, TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';

interface ITicketSidebarSystemUserCardProps {
  ticketSystemUser: ITicketSystemUser;
  onRemoveTicketSystemUser: (ticketSystemUserId: string) => Promise<void> | void;
  onUpdateTicketSystemUserStatus: (ticketSystemUserId: string, status: TicketSystemUserStatus) => Promise<void> | void;
}

/**
 * Sidebar card row for a ticket system user.
 *
 * Includes status and delete actions.
 *
 * @param {ITicketSidebarSystemUserCardProps} props
 * @return {*}
 */
export const TicketSidebarSystemUserCard = (props: ITicketSidebarSystemUserCardProps) => {
  const { ticketSystemUser, onRemoveTicketSystemUser, onUpdateTicketSystemUserStatus } = props;
  const statusOptions = useMemo(
    () =>
      (
        Object.entries(TICKET_SYSTEM_USER_STATUS_PRESENTATION) as Array<
          [TicketSystemUserStatus, (typeof TICKET_SYSTEM_USER_STATUS_PRESENTATION)[TicketSystemUserStatus]]
        >
      ).map(([value, presentation]) => ({
        value,
        label: presentation.label,
        icon: presentation.icon
      })),
    []
  );

  const displayLabel = ticketSystemUser.system_user.display_name ?? ticketSystemUser.system_user.user_identifier;
  const statusContextMenuItems: IContextMenuItem[] = statusOptions.map((statusOption) => ({
    label: statusOption.label,
    icon: <Icon path={statusOption.icon} size={0.7} />,
    onClick: () => onUpdateTicketSystemUserStatus(ticketSystemUser.ticket_system_user_id, statusOption.value)
  }));
  const deleteContextMenuItems: IContextMenuItem[] = [
    {
      label: 'Delete',
      icon: <Icon path={mdiTrashCanOutline} size={0.7} />,
      onClick: () => onRemoveTicketSystemUser(ticketSystemUser.ticket_system_user_id)
    }
  ];

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
          label={TICKET_SYSTEM_USER_STATUS_PRESENTATION[ticketSystemUser.status].label}
          color={TICKET_SYSTEM_USER_STATUS_PRESENTATION[ticketSystemUser.status].colour}
        />

        <ContextMenuButton
          buttonTitle={`ticket-system-user-${ticketSystemUser.ticket_system_user_id}-menu`}
          buttonIcon={<Icon path={mdiDotsVertical} size={0.75} />}
          itemGroups={[
            { groupId: 'status-options', items: statusContextMenuItems },
            { groupId: 'danger-actions', items: deleteContextMenuItems }
          ]}
        />
      </Box>
    </Paper>
  );
};
