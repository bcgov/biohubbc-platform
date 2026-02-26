import { mdiExportVariant, mdiTagOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { CustomTimeline, ICustomTimelineItem } from 'components/timeline';
import { ITicketStatusHistory } from 'interfaces/useTicketsApi.interface';
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

  if (!history.length) {
    return null;
  }

  const getStatusMessage = (status: 'open' | 'closed', index: number) => {
    if (status === 'closed') {
      return 'Ticket was closed';
    }

    return index === 0 ? 'Ticket was opened' : 'Ticket was reopened';
  };

  const timelineItems: ICustomTimelineItem[] = history.map((item, index) => ({
    id: item.ticket_status_history_id,
    content: <Typography variant="body2">{getStatusMessage(item.status, index)}</Typography>,
    icon: <Icon path={item.status === 'closed' ? mdiTagOutline : mdiExportVariant} size={0.85} />,
    rightContent: getRelativeTimeLabel(item.create_date, { maxRelativeDays: 30, absoluteFormat: 'MMM D, YYYY' })
  }));

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
