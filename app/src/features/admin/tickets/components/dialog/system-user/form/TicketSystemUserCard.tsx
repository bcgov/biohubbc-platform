import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { DropdownButton, IDropdownButtonItemGroup } from 'components/DropdownButton';
import { TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';

export interface ITicketSystemUserCardProps {
  systemUserId: number;
  userIdentifier: string;
  status: TicketSystemUserStatus;
  statusOptions: Array<{ value: TicketSystemUserStatus; label: string; iconPath: string }>;
  isSubmitting: boolean;
  onChangeStatus: (systemUserId: number, status: TicketSystemUserStatus) => void;
  onRemoveTicketSystemUser: () => void;
}

/**
 * Card row for a selected ticket system user with editable status.
 *
 * @param {ITicketSystemUserCardProps} props
 * @return {*}
 */
export const TicketSystemUserCard = (props: ITicketSystemUserCardProps) => {
  const {
    systemUserId,
    userIdentifier,
    status,
    statusOptions,
    isSubmitting,
    onChangeStatus,
    onRemoveTicketSystemUser
  } = props;
  const statusOptionGroups: IDropdownButtonItemGroup[] = [
    {
      groupId: 'status-options',
      items: statusOptions.map((statusOption) => ({
        value: statusOption.value,
        label: statusOption.label,
        iconPath: statusOption.iconPath
      }))
    }
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        backgroundColor: 'grey.100',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2
      }}>
      <Typography sx={{ fontWeight: 500 }}>{userIdentifier}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DropdownButton
          value={status}
          itemGroups={statusOptionGroups}
          size="small"
          disabled={isSubmitting}
          onSelect={(nextStatus) => onChangeStatus(systemUserId, nextStatus as TicketSystemUserStatus)}
        />
        <IconButton
          size="small"
          aria-label={`remove ${userIdentifier}`}
          onClick={onRemoveTicketSystemUser}
          disabled={isSubmitting}>
          <Icon path={mdiClose} size={0.65} />
        </IconButton>
      </Box>
    </Paper>
  );
};
