import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TICKET_TIMELINE_ICONS } from 'constants/icon';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { CustomTimeline, ICustomTimelineItem } from 'components/timeline';
import { ITicketStatusHistory } from 'interfaces/useTicketsApi.interface';
import { getRelativeTimeLabel } from 'utils/date';
import { TicketCommentTimelineEvent } from '../components/TicketCommentTimelineEvent';

interface ITicketTimelineProps {
  history: ITicketStatusHistory[];
  isLoading: boolean;
}

/**
 * Renders the timeline section for a ticket.
 *
 * @param {ITicketTimelineProps} props
 * @return {*}
 */
export const TicketTimeline = (props: ITicketTimelineProps) => {
  const { history, isLoading } = props;

  if (!history.length) {
    return null;
  }

  let hasSeenOpenStatus = false;

  const timelineItems: ICustomTimelineItem[] = history.map((item, index) => {
    const itemId = item.ticket_status_history_id ?? item.ticket_comment_id ?? `${item.create_date}-${index}`;
    const isCommentEvent = Boolean(item.comment);

    if (isCommentEvent) {
      return {
        id: itemId,
        icon: <Icon path={TICKET_TIMELINE_ICONS.comment} size={0.75} />,
        stretchToRightEdge: true,
        content: (
          <TicketCommentTimelineEvent
            author={item.user_identifier || 'Unknown user'}
            comment={item.comment ?? ''}
            dateLabel={getRelativeTimeLabel(item.create_date, { maxRelativeDays: 30, absoluteFormat: 'MMM D, YYYY' }) ?? ''}
          />
        )
      };
    }

    const actor = item.user_identifier || 'Unknown user';
    const isFirstOpenStatus = item.status === 'open' && !hasSeenOpenStatus;

    if (item.status === 'open') {
      hasSeenOpenStatus = true;
    }

    let message = `${actor} reopened the ticket`;

    if (item.status === 'closed') {
      message = `${actor} closed the ticket`;
    } else if (isFirstOpenStatus) {
      message = `${actor} opened the ticket`;
    }

    return {
      id: itemId,
      icon: <Icon path={TICKET_TIMELINE_ICONS[item.status ?? 'open']} size={0.75} />,
      content: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">{message}</Typography>
          <Typography variant="body2" color="text.secondary">
            {getRelativeTimeLabel(item.create_date, { maxRelativeDays: 30, absoluteFormat: 'MMM D, YYYY' })}
          </Typography>
        </Box>
      )
    };
  });

  return (
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={
        <Stack gap={1.5}>
          <Skeleton variant="rounded" height={52} />
          <Skeleton variant="rounded" height={52} />
        </Stack>
      }>
      <CustomTimeline items={timelineItems} dataTestId="ticket-status-history-timeline" />
    </LoadingGuard>
  );
};
