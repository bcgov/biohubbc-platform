import { mdiChevronDown, mdiChevronUp } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { useApi } from 'hooks/useApi';
import { useCallback, useId, useState } from 'react';
import { getSubmissionUploadJobStatusPresentation } from 'utils/submission-upload-status';
import { ITicketUploadStatusRowProps, SubmissionUploadStatusHistoryState } from '../TicketUploadTimelineItem.interface';
import { TicketUploadStatusHistory } from './TicketUploadStatusHistory';

/**
 * Current processing status of a submission upload, expandable to show how the upload progressed
 * through each processing stage.
 *
 * The history endpoint is admin-only, so the row is expandable only when `canViewStatusHistory` is
 * set; otherwise it is a static row showing the current status and never requests the history. When
 * expandable, the history is loaded while the row is expanded and cached per upload and current
 * status, so re-expanding reuses a loaded history, a status change loads the grown one, and a failed
 * request is retried the next time the row is expanded. Nothing below the current status renders
 * until the row has been expanded.
 *
 * @param {ITicketUploadStatusRowProps} props
 * @return {*}
 */
export const TicketUploadStatusRow = (props: ITicketUploadStatusRowProps) => {
  const { upload, canViewStatusHistory } = props;
  const api = useApi();
  const [isExpanded, setIsExpanded] = useState(false);
  const historyRegionId = useId();

  const historyQuery = useQuery({
    queryKey: submissionUploadQueryKeys.statusHistory(
      { submissionId: upload.submission_id, submissionUploadId: upload.submission_upload_id },
      upload.upload_status
    ),
    queryFn: ({ signal }) =>
      api.tickets.getSubmissionUploadProcessingStatusHistory(upload.submission_id, upload.submission_upload_id, {
        signal
      }),
    enabled: canViewStatusHistory && isExpanded,
    staleTime: Infinity
  });

  let statusHistory: SubmissionUploadStatusHistoryState | undefined;
  if (historyQuery.data) {
    statusHistory = { status: 'loaded', history: historyQuery.data };
  } else if (historyQuery.error && !historyQuery.isFetching) {
    statusHistory = { status: 'error', message: historyQuery.error.message };
  } else if (historyQuery.isFetching) {
    statusHistory = { status: 'loading' };
  }

  const presentation = getSubmissionUploadJobStatusPresentation(upload.upload_status);
  const showStatusIcon = presentation.isTerminal || !presentation.isKnown;

  /**
   * Flip the expanded state; the history query loads while the row is expanded.
   *
   * @returns {void}
   */
  const handleToggle = useCallback(() => {
    setIsExpanded((previous) => !previous);
  }, []);

  const currentStatus = (
    <>
      {showStatusIcon ? (
        <Icon path={presentation.iconPath} size={0.7} style={{ color: presentation.iconColor }} />
      ) : (
        <CircularProgress size={14} thickness={5} sx={{ color: 'primary.main', flexShrink: 0 }} />
      )}
      <Typography variant="body2" sx={{ flex: '1 1 auto' }}>
        {presentation.label}
      </Typography>
    </>
  );

  const rowSx = {
    width: '100%',
    px: 2,
    py: 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1.5,
    textAlign: 'left'
  } as const;

  if (!canViewStatusHistory) {
    return <Box sx={{ ...rowSx, borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>{currentStatus}</Box>;
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
      <ButtonBase onClick={handleToggle} aria-expanded={isExpanded} aria-controls={historyRegionId} sx={rowSx}>
        {currentStatus}
        <Icon path={isExpanded ? mdiChevronUp : mdiChevronDown} size={0.9} aria-hidden="true" />
      </ButtonBase>
      <Collapse in={isExpanded}>
        <Box id={historyRegionId} role="region" aria-label="Processing history" sx={{ px: 2, pb: 1.5, minHeight: 112 }}>
          {(isExpanded || statusHistory) && <TicketUploadStatusHistory statusHistory={statusHistory} />}
        </Box>
      </Collapse>
    </Box>
  );
};
