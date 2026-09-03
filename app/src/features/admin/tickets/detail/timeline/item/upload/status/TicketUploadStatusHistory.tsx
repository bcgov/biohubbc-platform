import { mdiAlertOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { getSubmissionUploadJobStatusPresentation } from 'utils/submission-upload-status';
import { getFormattedDate } from 'utils/Utils';
import { ITicketUploadStatusHistoryProps } from '../TicketUploadTimelineItem.interface';

/**
 * Processing status history of a submission upload, in the order the API returned it.
 *
 * Renders the loading, error and empty states in the same footprint as the loaded list so the
 * timeline does not jump while the history is fetched or retried.
 *
 * @param {ITicketUploadStatusHistoryProps} props
 * @return {*}
 */
export const TicketUploadStatusHistory = (props: ITicketUploadStatusHistoryProps) => {
  const { statusHistory } = props;

  if (!statusHistory || statusHistory.status === 'loading') {
    return <SkeletonList numberOfLines={2} />;
  }

  if (statusHistory.status === 'error') {
    return (
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ minHeight: 112 }}>
        <Icon path={mdiAlertOutline} size={0.9} />
        <Typography variant="body2">Failed to load processing history</Typography>
      </Stack>
    );
  }

  if (!statusHistory.history.length) {
    return (
      <Stack justifyContent="center" sx={{ minHeight: 112 }}>
        <Typography variant="body2" color="text.secondary">
          No processing history
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack component="ol" sx={{ listStyle: 'none', m: 0, p: 0, minHeight: 112 }}>
      {statusHistory.history.map((item) => {
        const presentation = getSubmissionUploadJobStatusPresentation(item.status);

        return (
          <Stack
            component="li"
            key={item.submission_upload_status_id}
            direction="row"
            alignItems="center"
            gap={1.5}
            sx={{ py: 0.75 }}>
            <Icon path={presentation.iconPath} size={0.7} style={{ color: presentation.iconColor }} />
            <Typography variant="body2" sx={{ flex: '1 1 auto' }}>
              {presentation.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, item.create_date)}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
};
