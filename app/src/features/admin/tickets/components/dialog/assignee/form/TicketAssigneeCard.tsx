import { mdiCheck, mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { DropdownButton, IDropdownButtonItemGroup } from 'components/DropdownButton';
import { TicketSystemUserStatus } from 'interfaces/useTicketsApi.interface';

export interface ITicketAssigneeCardProps {
  systemUserId: number;
  userIdentifier: string;
  status: TicketSystemUserStatus;
  statusOptions: Array<{ value: TicketSystemUserStatus; label: string }>;
  isSubmitting: boolean;
  onChangeStatus: (systemUserId: number, status: TicketSystemUserStatus) => void;
  onRemoveAssignee: () => void;
}

/**
 * Card row for a selected ticket assignee with editable status.
 *
 * @param {ITicketAssigneeCardProps} props
 * @return {*}
 */
export const TicketAssigneeCard = (props: ITicketAssigneeCardProps) => {
  const { systemUserId, userIdentifier, status, statusOptions, isSubmitting, onChangeStatus, onRemoveAssignee } =
    props;
  const statusOptionGroups: IDropdownButtonItemGroup[] = [
    {
      groupId: 'status-options',
      items: statusOptions.map((statusOption) => ({
        value: statusOption.value,
        label: statusOption.label,
        iconPath: mdiCheck
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
          onClick={onRemoveAssignee}
          disabled={isSubmitting}>
          <Icon path={mdiClose} size={0.65} />
        </IconButton>
      </Box>
    </Paper>
  );
};
