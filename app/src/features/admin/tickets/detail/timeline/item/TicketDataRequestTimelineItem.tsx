import { Button, Stack, Typography } from '@mui/material';
import { IAddPolicyFormValues } from 'features/admin/policies/components/AddPolicyForm';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { TicketTimelineItem } from './TicketTimelineItem';

interface ITicketDataRequestTimelineItemProps {
  dataRequest: DataRequestResponse;
  dateLabel: string;
  isUpdating: boolean;
  onViewPolicy: (dataRequestId: string, policyId: string, initialValues?: Partial<IAddPolicyFormValues>) => void;
  onViewFinalizedPolicy: (dataRequestId: string, policyId: string) => void;
  onApprove: (dataRequestId: string) => void;
  onDeny: (dataRequestId: string) => void;
  onResetToReviewed: (dataRequestId: string) => void;
}

/**
 * Ticket timeline event card for data requests.
 *
 * @param {ITicketDataRequestTimelineItemProps} props
 * @return {*}
 */
export const TicketDataRequestTimelineItem = (props: ITicketDataRequestTimelineItemProps) => {
  const {
    dataRequest,
    dateLabel,
    isUpdating,
    onViewPolicy,
    onViewFinalizedPolicy,
    onApprove,
    onDeny,
    onResetToReviewed
  } = props;
  const requestStatus = dataRequest.status;
  const isRequested = requestStatus === PolicyStatus.REQUESTED;
  const isFinalized = requestStatus === PolicyStatus.APPROVED || requestStatus === PolicyStatus.DENIED;
  const finalizedLabel = `${requestStatus.charAt(0).toUpperCase()}${requestStatus.slice(1)}`;
  const finalizedButtonColor = requestStatus === PolicyStatus.APPROVED ? 'success' : 'error';
  let actionButtons;

  if (isRequested) {
    actionButtons = (
      <Button
        size="small"
        color="primary"
        variant="contained"
        onClick={() =>
          onViewPolicy(dataRequest.data_request_id, dataRequest.policy_id, { status: PolicyStatus.REVIEWED })
        }
        disabled={isUpdating}>
        Review Policy
      </Button>
    );
  } else if (isFinalized) {
    actionButtons = (
      <>
        <Button
          size="small"
          color="primary"
          variant="outlined"
          onClick={() => onViewFinalizedPolicy(dataRequest.data_request_id, dataRequest.policy_id)}
          disabled={isUpdating}>
          View Policy
        </Button>
        <Button
          size="small"
          color={finalizedButtonColor}
          variant="contained"
          onClick={() => onResetToReviewed(dataRequest.data_request_id)}
          disabled={isUpdating}>
          {finalizedLabel}
        </Button>
      </>
    );
  } else {
    actionButtons = (
      <>
        <Button
          size="small"
          color="primary"
          variant="outlined"
          onClick={() => onViewPolicy(dataRequest.data_request_id, dataRequest.policy_id)}
          disabled={isUpdating}>
          View Policy
        </Button>
        <Button
          size="small"
          color="success"
          variant="contained"
          onClick={() => onApprove(dataRequest.data_request_id)}
          disabled={isUpdating}>
          Approve
        </Button>
        <Button
          size="small"
          color="error"
          variant="contained"
          onClick={() => onDeny(dataRequest.data_request_id)}
          disabled={isUpdating}>
          Deny
        </Button>
      </>
    );
  }

  return (
    <TicketTimelineItem
      title="Data Request"
      dateLabel={dateLabel}
      actions={
        <Stack direction="row" spacing={1}>
          {actionButtons}
        </Stack>
      }>
      <Typography variant="body2">{dataRequest.reason}</Typography>
    </TicketTimelineItem>
  );
};
