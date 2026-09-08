import { mdiAlertOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import {
  COMPLETED_SUBMISSION_UPLOAD_JOB_STATUS_ICON,
  COMPLETED_SUBMISSION_UPLOAD_JOB_STATUS_ICON_COLOR,
  SUBMISSION_UPLOAD_FAILURE_JOB_STATUSES
} from 'constants/submission-upload-status';
import { getSubmissionUploadJobStatusPresentation, isSubmissionUploadJobStatus } from 'utils/submission-upload-status';
import { getFormattedDate } from 'utils/Utils';
import { ITicketUploadStatusHistoryProps } from '../TicketUploadTimelineItem.interface';

/**
 * Processing status history of a submission upload, in the order the API returned it.
 *
 * A row shows a completed checkmark only when the upload went on to a later stage from it. The last
 * row is the status the upload currently holds, and a stage that ended in `invalid` or `failed`
 * never completed, so both keep the status's own icon. Renders the loading, error and empty states
 * in the same footprint as the loaded list so the timeline does not jump while the history is
 * fetched or retried.
 *
 * @param {ITicketUploadStatusHistoryProps} props
 * @return {*}
 */
/**
 * Whether a history row's stage completed, judged by what the upload moved on to next.
 *
 * @param {string | undefined} nextStatus Status of the following history row, if any.
 * @returns {boolean} True when a later row exists and it is not a failure outcome.
 */
const isStageCompleted = (nextStatus: string | undefined): boolean =>
  nextStatus !== undefined &&
  !(isSubmissionUploadJobStatus(nextStatus) && SUBMISSION_UPLOAD_FAILURE_JOB_STATUSES.includes(nextStatus));

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
      {statusHistory.history.map((item, index) => {
        const presentation = getSubmissionUploadJobStatusPresentation(item.status);
        const isCompleted = isStageCompleted(statusHistory.history[index + 1]?.status);
        const iconPath = isCompleted ? COMPLETED_SUBMISSION_UPLOAD_JOB_STATUS_ICON : presentation.iconPath;
        const iconColor = isCompleted ? COMPLETED_SUBMISSION_UPLOAD_JOB_STATUS_ICON_COLOR : presentation.iconColor;

        return (
          <Stack
            component="li"
            key={item.submission_upload_status_id}
            direction="row"
            alignItems="center"
            gap={1.5}
            sx={{ py: 0.75 }}>
            <Icon path={iconPath} size={0.7} style={{ color: iconColor }} />
            <Typography variant="body2">{presentation.label}</Typography>
            <Box
              aria-hidden="true"
              sx={{
                flex: '1 1 auto',
                alignSelf: 'flex-end',
                mb: 0.75,
                borderBottom: 1,
                borderBottomStyle: 'dotted',
                borderColor: 'text.disabled'
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, item.create_date)}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
};
