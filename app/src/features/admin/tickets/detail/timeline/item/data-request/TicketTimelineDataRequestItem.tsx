import { Button, Stack, Typography } from '@mui/material';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { IAddPolicyFormValues } from 'features/admin/policies/components/AddPolicyForm';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { TicketTimelineItem } from '../layout/TicketTimelineItem';

interface ITicketTimelineDataRequestItemProps {
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
 * @param {ITicketTimelineDataRequestItemProps} props
 * @return {*}
 */
export const TicketTimelineDataRequestItem = (props: ITicketTimelineDataRequestItemProps) => {
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
  const finalizedLabel = `${requestStatus.charAt(0).toUpperCase()}${requestStatus.slice(1)}`;
  const finalizedButtonColor = requestStatus === PolicyStatus.APPROVED ? 'success' : 'error';
  const finalizedActions = (
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

  return (
    <TicketTimelineItem
      title="Data Request"
      dateLabel={dateLabel}
      actions={
        <Stack direction="row" spacing={1}>
          <ComponentSwitch<PolicyStatus>
            switch={requestStatus}
            components={{
              [PolicyStatus.REQUESTED]: (
                <Button
                  size="small"
                  color="primary"
                  variant="contained"
                  onClick={() =>
                    onViewPolicy(dataRequest.data_request_id, dataRequest.policy_id, {
                      status: PolicyStatus.REVIEWED
                    })
                  }
                  disabled={isUpdating}>
                  Review Policy
                </Button>
              ),
              [PolicyStatus.REVIEWED]: (
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
              ),
              [PolicyStatus.APPROVED]: finalizedActions,
              [PolicyStatus.DENIED]: finalizedActions
            }}
          />
        </Stack>
      }>
      <Typography variant="body2">{dataRequest.reason}</Typography>
    </TicketTimelineItem>
  );
};
