import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DropdownButtonGroup } from 'components/DropdownButtonGroup';
import {
  SUBMISSION_UPLOAD_FINAL_DECISION_OPTIONS,
  SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX,
  SUBMISSION_UPLOAD_REVIEW_STATUS_LABELS
} from 'constants/submission-upload-status';
import { SubmissionUploadReviewStatus } from 'interfaces/useTicketsApi.interface';
import { ITicketUploadDecisionRowProps } from '../TicketUploadTimelineItem.interface';

/**
 * Displays the upload final decision action or finalized status.
 *
 * @param {ITicketUploadDecisionRowProps} props
 * @return {*}
 */
export const TicketUploadDecisionRow = (props: ITicketUploadDecisionRowProps) => {
  const { upload, onAccept, onReject, onResetDecision } = props;

  const decisionButtonColorByStatus: Partial<Record<SubmissionUploadReviewStatus, 'success' | 'error'>> = {
    approved: 'success',
    denied: 'error'
  };

  const handleFinalDecisionSelect = (value: string) => {
    if (value === 'approved') {
      onAccept(upload);
      return;
    }

    if (value === 'denied') {
      onReject(upload);
    }
  };

  const finalDecisionButtonColor = decisionButtonColorByStatus[upload.review_status];

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
          onSelect={handleFinalDecisionSelect}
        />
      ) : (
        <Button
          size="small"
          variant="contained"
          color={finalDecisionButtonColor}
          onClick={() => onResetDecision(upload)}>
          {SUBMISSION_UPLOAD_REVIEW_STATUS_LABELS[upload.review_status]}
        </Button>
      )}
    </Box>
  );
};
