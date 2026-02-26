import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { PropsWithChildren, ReactNode } from 'react';

interface ITicketTimelineEventProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  dateLabel?: ReactNode;
  actions?: ReactNode;
}

/**
 * Reusable timeline event card wrapper for ticket timeline entries.
 *
 * @param {PropsWithChildren<ITicketTimelineEventProps>} props
 * @return {*}
 */
export const TicketTimelineEvent = (props: PropsWithChildren<ITicketTimelineEventProps>) => {
  const { icon, title, subtitle, dateLabel, actions, children } = props;

  return (
    <Paper variant="outlined">
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: children ? 1 : 0,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}>
        <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon ? <Box sx={{ display: 'flex', alignItems: 'center' }}>{icon}</Box> : null}
          <Typography variant="body2" fontWeight={700}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {dateLabel ? (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {dateLabel}
          </Typography>
        ) : null}
      </Box>

      {children ? <Box sx={{ p: 2.5 }}>{children}</Box> : null}

      {actions ? (
        <Box sx={{ px: 2.5, pb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>{actions}</Box>
      ) : null}
    </Paper>
  );
};
