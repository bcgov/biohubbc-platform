import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ITicketStatusHistory } from 'interfaces/useTicketsApi.interface';

interface ITicketStatusTimelineProps {
  history: ITicketStatusHistory[];
  isLoading: boolean;
}

/**
 * Renders ticket status history entries in timeline order.
 *
 * @param {ITicketStatusTimelineProps} props
 * @return {*}
 */
export const TicketStatusTimeline = (props: ITicketStatusTimelineProps) => {
  const { history, isLoading } = props;

  if (isLoading) {
    return (
      <Stack gap={1.5}>
        <Skeleton variant="rounded" height={52} />
        <Skeleton variant="rounded" height={52} />
      </Stack>
    );
  }

  if (!history.length) {
    return null;
  }

  const getStatusMessage = (status: 'open' | 'closed', index: number, total: number) => {
    if (status === 'closed') {
      return 'Ticket was closed';
    }

    return index === total - 1 ? 'Ticket was opened' : 'Ticket was reopened';
  };

  return (
    <Stack spacing={2.5} data-testid="ticket-status-history-timeline">
      {history.map((item, index) => (
        <Box key={item.ticket_status_history_id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
          <Box sx={{ position: 'relative', width: 32, minHeight: 38, display: 'flex', justifyContent: 'center' }}>
            {index < history.length - 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 28,
                  bottom: -18,
                  width: 2,
                  bgcolor: 'divider'
                }}
              />
            )}
            <Box sx={{ width: 32, height: 32, borderRadius: 1.25, bgcolor: 'grey.300', mt: 0.25 }} />
          </Box>

          <Typography sx={{ pt: 0.75 }}>
            {getStatusMessage(item.status, index, history.length)}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
};
