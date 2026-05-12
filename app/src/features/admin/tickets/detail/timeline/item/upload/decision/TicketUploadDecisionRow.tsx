import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DropdownButtonGroup } from 'components/DropdownButtonGroup';
import {
  SUBMISSION_UPLOAD_FINAL_DECISION_OPTIONS,
  SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX,
  SUBMISSION_UPLOAD_REVIEW_STATUS_LABELS
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
  let finalDecisionButtonColor: 'success' | 'error' | undefined;

  if (upload.review_status === 'approved') {
    finalDecisionButtonColor = 'success';
  }

  if (upload.review_status === 'denied') {
    finalDecisionButtonColor = 'error';
  }

  return (
    <Box
      sx={{
        px: 2,
        pt: 2,
        borderTop: 1,
        borderColor: 'divider'
      }}>
      {upload.review_status === 'submitted' ? (
        <DropdownButtonGroup
          value={upload.review_status}
          primaryLabel="Accept"
          itemGroups={[
            { groupId: 'submission-upload-final-decision', items: SUBMISSION_UPLOAD_FINAL_DECISION_OPTIONS }
          ]}
          size="small"
          variant="contained"
          sx={SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX}
          onPrimaryClick={() => onAccept(upload)}
          onSelect={(value) => {
            if (value === 'approved') {
              onAccept(upload);
            }

            if (value === 'denied') {
              onReject(upload);
            }
          }}
        />
      ) : (
        <Button size="small" variant="contained" color={finalDecisionButtonColor} onClick={() => onResetDecision(upload)}>
          {SUBMISSION_UPLOAD_REVIEW_STATUS_LABELS[upload.review_status]}
        </Button>
      )}
    </Box>
  );
};
