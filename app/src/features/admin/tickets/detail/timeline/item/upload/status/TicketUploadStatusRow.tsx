import { mdiCheck, mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import {
  SUBMISSION_UPLOAD_JOB_STATUS_LABELS,
  TERMINAL_SUBMISSION_UPLOAD_JOB_STATUSES
} from 'constants/submission-upload-status';
import appTheme from 'themes/appTheme';
import { ITicketUploadStatusRowProps } from '../TicketUploadTimelineItem.interface';

/**
 * Displays the submission upload ingestion/indexing status for the upload timeline card.
 *
 * @param {ITicketUploadStatusRowProps} props
 * @return {*}
 */
export const TicketUploadStatusRow = (props: ITicketUploadStatusRowProps) => {
  const { upload } = props;
  const statusColor =
    upload.upload_status === 'indexed'
      ? 'success.main'
      : upload.upload_status === 'invalid' || upload.upload_status === 'failed'
        ? 'error.main'
        : 'primary.main';
  const isTerminalUploadStatus = TERMINAL_SUBMISSION_UPLOAD_JOB_STATUSES.includes(upload.upload_status);
  const terminalStatusIcon = upload.upload_status === 'indexed' ? mdiCheck : mdiClose;
  const terminalStatusColor =
    upload.upload_status === 'indexed' ? appTheme.palette.success.main : appTheme.palette.error.main;

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: 'grey.50'
      }}>
      {isTerminalUploadStatus ? (
        <Icon path={terminalStatusIcon} size={0.7} style={{ color: terminalStatusColor }} />
      ) : (
        <CircularProgress size={14} thickness={5} sx={{ color: statusColor, flexShrink: 0 }} />
      )}
      <Typography variant="body2">{SUBMISSION_UPLOAD_JOB_STATUS_LABELS[upload.upload_status]}</Typography>
    </Box>
  );
};
