import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface ITicketTimelineStatusItemProps {
  message: string;
  dateLabel: string;
}

/**
 * Ticket timeline event row for status changes.
 *
 * @param {ITicketTimelineStatusItemProps} props
 * @return {*}
 */
export const TicketTimelineStatusItem = (props: ITicketTimelineStatusItemProps) => {
  const { message, dateLabel } = props;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2">{message}</Typography>
      <Typography variant="body2" color="text.secondary">
        {dateLabel}
      </Typography>
    </Box>
  );
};
