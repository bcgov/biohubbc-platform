import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import {
  SUBMISSION_UPLOAD_DECISION_BUTTON_COLORS,
  SUBMISSION_UPLOAD_DECISION_LABELS
} from 'constants/submission-upload-status';
import { ITicketUploadDecisionRowProps } from '../TicketUploadTimelineItem.interface';

/**
 * Displays the upload final decision action or finalized status.
 *
 * @param {ITicketUploadDecisionRowProps} props
 * @return {*}
 */
export const TicketUploadDecisionRow = (props: ITicketUploadDecisionRowProps) => {
  const { upload, onAccept, onReject, onResetDecision } = props;

  const finalDecisionButtonColor = SUBMISSION_UPLOAD_DECISION_BUTTON_COLORS[upload.decision];

  return (
    <Box
      sx={{
        px: 2,
        pt: 2,
        borderTop: 1,
        borderColor: 'divider'
      }}>
      {upload.decision === 'pending' ? (
        <Stack direction="row" spacing={1}>
          <Button size="small" color="success" variant="contained" onClick={() => onAccept(upload)}>
            Accept
          </Button>
          <Button size="small" color="error" variant="contained" onClick={() => onReject(upload)}>
            Deny
          </Button>
        </Stack>
      ) : (
        <Button
          size="small"
          variant="contained"
          color={finalDecisionButtonColor}
          onClick={() => onResetDecision(upload)}>
          {SUBMISSION_UPLOAD_DECISION_LABELS[upload.decision]}
        </Button>
      )}
    </Box>
  );
};
