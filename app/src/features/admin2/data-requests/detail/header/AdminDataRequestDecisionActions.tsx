import Button from '@mui/material/Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { POLICY_STATUS_LABELS } from 'constants/policy';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { DataRequestListItem } from 'interfaces/useDataRequestApi.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

interface AdminDataRequestDecisionActionsProps {
  dataRequest: DataRequestListItem;
}

/**
 * Decision actions in the header of the administrative data request page, matching the ticket timeline's data request
 * card. An undecided request offers Approve and Deny. A decided request shows its decision as a single button, which
 * moves it back to reviewed. Every change is confirmed first, and is made by changing the status of the request's
 * policy.
 *
 * @param {AdminDataRequestDecisionActionsProps} props The data request to decide.
 * @returns {JSX.Element} Approve and Deny buttons, or the decision button.
 */
export const AdminDataRequestDecisionActions = ({ dataRequest }: AdminDataRequestDecisionActionsProps) => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const statusMutation = useMutation({
    mutationFn: (status: PolicyStatus) => biohubApi.policies.updatePolicyStatus(dataRequest.policy_id, { status }),
    // The decision is the policy's status, shown on this page, the data requests and policies lists, and the ticket.
    onSuccess: () => refreshChangedQueries(queryClient, changedQueryKeys.dataRequest(dataRequest.ticket_id)),
    onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });

  /**
   * Asks for confirmation, then changes the decision.
   *
   * @param {PolicyStatus} status The status to move the request's policy to.
   * @param {string} dialogTitle Title of the confirmation dialog.
   * @param {string} dialogText Question the confirmation dialog asks.
   * @param {string} yesButtonLabel Label of the confirming button.
   * @returns {void}
   */
  const confirmStatusChange = (
    status: PolicyStatus,
    dialogTitle: string,
    dialogText: string,
    yesButtonLabel: string
  ) => {
    const closeDialog = () => dialogContext.setYesNoDialog({ open: false });

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle,
      dialogText,
      yesButtonLabel,
      noButtonLabel: 'Cancel',
      onClose: closeDialog,
      onNo: closeDialog,
      onYes: () => {
        closeDialog();
        statusMutation.mutate(status);
      }
    });
  };

  const isDecided = dataRequest.status === PolicyStatus.APPROVED || dataRequest.status === PolicyStatus.DENIED;

  if (isDecided) {
    const decisionLabel = POLICY_STATUS_LABELS[dataRequest.status];

    return (
      <Button
        size="small"
        variant="contained"
        color={dataRequest.status === PolicyStatus.APPROVED ? 'success' : 'error'}
        disabled={statusMutation.isPending}
        data-testid="data-request-decision-button"
        onClick={() =>
          confirmStatusChange(
            PolicyStatus.REVIEWED,
            `Reset ${decisionLabel} to Reviewed`,
            `Are you sure you want to change this status from ${decisionLabel} back to Reviewed?`,
            'Yes'
          )
        }>
        {decisionLabel}
      </Button>
    );
  }

  return (
    <>
      <Button
        size="small"
        variant="contained"
        color="success"
        disabled={statusMutation.isPending}
        onClick={() =>
          confirmStatusChange(
            PolicyStatus.APPROVED,
            'Confirm Approval',
            'Are you sure you want to approve this data request?',
            'Approve'
          )
        }>
        Approve
      </Button>
      <Button
        size="small"
        variant="contained"
        color="error"
        disabled={statusMutation.isPending}
        onClick={() =>
          confirmStatusChange(
            PolicyStatus.DENIED,
            'Confirm Denial',
            'Are you sure you want to deny this data request?',
            'Deny'
          )
        }>
        Deny
      </Button>
    </>
  );
};
