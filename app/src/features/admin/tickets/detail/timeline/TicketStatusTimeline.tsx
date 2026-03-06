import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { CustomTimeline, ICustomTimelineItem } from 'components/timeline';
import { TICKET_TIMELINE_ICONS } from 'constants/icon';
import { ITicketStatusHistory, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { getRelativeTimeLabel } from 'utils/date';

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

  const getStatusMessage = (userIdentifier: string, status: TicketStatus, isFirstOpenStatus: boolean) => {
    const actor = userIdentifier;

    if (status === 'closed') {
      return `${actor} closed the ticket`;
    }

    return isFirstOpenStatus ? `${actor} opened the ticket` : `${actor} reopened the ticket`;
  };

  // The first "open" status is "opened"; later "open" statuses are "reopened".
  const firstOpenStatusIndex = history.findIndex((item) => item.status === 'open');

  const timelineItems: ICustomTimelineItem[] = history.map((item, index) => {
    const itemId = item.ticket_status_history_id ?? item.ticket_comment_id ?? `${item.create_date}-${index}`;
    const isStatusEvent = Boolean(item.status);
    const isFirstOpenStatus = item.status === 'open' && index === firstOpenStatusIndex;

    const message = isStatusEvent
      ? getStatusMessage(item.user_identifier, item.status as TicketStatus, isFirstOpenStatus)
      : `${item.user_identifier} commented: ${item.comment ?? ''}`;

    const iconPath = isStatusEvent ? TICKET_TIMELINE_ICONS[item.status as TicketStatus] : TICKET_TIMELINE_ICONS.comment;

    return {
      id: itemId,
      icon: <Icon path={iconPath} size={0.75} />,
      children: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">{message}</Typography>
          <Typography variant="body2" color="text.secondary">
            {getRelativeTimeLabel(item.create_date, { maxRelativeDays: 30, absoluteFormat: 'MMM D, YYYY' })}
          </Typography>
        </Box>
      )
    };
  });

  if (!history.length) {
    return null;
  }

  return (
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={
        <Stack gap={1.5}>
          <Skeleton variant="rounded" height={52} />
          <Skeleton variant="rounded" height={52} />
        </Stack>
      }>
      <CustomTimeline items={timelineItems} />
    </LoadingGuard>
  );
};
