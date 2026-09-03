import { mdiChevronDown, mdiChevronUp } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import { SUBMISSION_UPLOAD_JOB_STATUS_COLORS } from 'constants/submission-upload-status';
import { useCallback, useId, useState } from 'react';
import { getSubmissionUploadJobStatusPresentation } from 'utils/submission-upload-status';
import { ITicketUploadStatusRowProps } from '../TicketUploadTimelineItem.interface';
import { TicketUploadStatusHistory } from './TicketUploadStatusHistory';

/**
 * Current processing status of a submission upload, expandable to show how the upload progressed
 * through each processing stage.
 *
 * The history is requested when the row is first expanded and comes from the timeline-level cache,
 * so collapsing and re-expanding reuses a loaded response and retries a failed one.
 *
 * @param {ITicketUploadStatusRowProps} props
 * @return {*}
 */
export const TicketUploadStatusRow = (props: ITicketUploadStatusRowProps) => {
  const { upload, statusHistory, onLoadStatusHistory } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const historyRegionId = useId();

  const presentation = getSubmissionUploadJobStatusPresentation(upload.upload_status);
  const showStatusIcon = presentation.isTerminal || !presentation.isKnown;
  const spinnerColor = SUBMISSION_UPLOAD_JOB_STATUS_COLORS[upload.upload_status] ?? 'primary.main';

  const handleToggle = useCallback(() => {
    const nextIsExpanded = !isExpanded;
    setIsExpanded(nextIsExpanded);

    if (nextIsExpanded) {
      onLoadStatusHistory(upload);
    }
  }, [isExpanded, onLoadStatusHistory, upload]);

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
      <ButtonBase
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={historyRegionId}
        sx={{
          width: '100%',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1.5,
          textAlign: 'left'
        }}>
        {showStatusIcon ? (
          <Icon path={presentation.iconPath} size={0.7} style={{ color: presentation.iconColor }} />
        ) : (
          <CircularProgress size={14} thickness={5} sx={{ color: spinnerColor, flexShrink: 0 }} />
        )}
        <Typography variant="body2" sx={{ flex: '1 1 auto' }}>
          {presentation.label}
        </Typography>
        <Icon path={isExpanded ? mdiChevronUp : mdiChevronDown} size={0.9} aria-hidden="true" />
      </ButtonBase>
      <Collapse in={isExpanded}>
        <Box id={historyRegionId} role="region" aria-label="Processing history" sx={{ px: 2, pb: 1.5, minHeight: 112 }}>
          <TicketUploadStatusHistory statusHistory={statusHistory} />
        </Box>
      </Collapse>
    </Box>
  );
};
