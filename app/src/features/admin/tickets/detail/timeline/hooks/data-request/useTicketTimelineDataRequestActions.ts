import { reconcileAfterMutations } from 'hooks/useCoordinatedMutation';
import { useQueryClient } from '@tanstack/react-query';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTicketTimelineConfirmationDialog } from '../useTicketTimelineConfirmationDialog';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/**
 * Data-request status and navigation handlers for the ticket timeline.
 *
 * @returns Timeline data-request action state and handlers.
 */
export const useTicketTimelineDataRequestActions = () => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();
  const { openConfirmationDialog } = useTicketTimelineConfirmationDialog();
  const queryClient = useQueryClient();
  const { ticketId, ticketQueryKey } = useTicketContext();
  const [updatingDataRequestId, setUpdatingDataRequestId] = useState<string | null>(null);

  /**
   * Persist a data-request policy status transition and refresh the ticket.
   *
   * Confirmation handlers call this after the user approves the status change. The active data request id is stored so
   * the matching timeline item can disable its action buttons while the API call is running.
   *
   * @param {string} dataRequestId Identifier of the data request being updated.
   * @param {string} policyId Identifier of the policy tied to the data request.
   * @param {PolicyStatus} policyStatus Next status to persist.
   * @returns {Promise<void>} Resolves after the update attempt has completed.
   */
  const handleDataRequestStatusUpdate = async (dataRequestId: string, policyId: string, policyStatus: PolicyStatus) => {
    try {
      setUpdatingDataRequestId(dataRequestId);

      await api.policies.updatePolicyStatus(policyId, {
        status: policyStatus
      });

      await queryClient.cancelQueries({ queryKey: ticketQueryKey, exact: true });
      await reconcileAfterMutations(queryClient, ticketQueryKey, ticketQueryKey);
      void refreshChangedQueries(queryClient, changedQueryKeys.dataRequest(ticketId), ticketQueryKey);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setUpdatingDataRequestId(null);
    }
  };

  /**
   * Open the confirmation dialog for approve or deny status changes.
   *
   * Timeline data-request items call this before mutating policy status so users explicitly confirm approval or denial.
   *
   * @param {string} dataRequestId Identifier of the data request whose status will change.
   * @param {string} policyId Identifier of the policy tied to the data request.
   * @param {PolicyStatus} policyStatus Status to apply after confirmation.
   * @returns {void}
   */
  const handleConfirmDataRequestStatusUpdate = (
    dataRequestId: string,
    policyId: string,
    policyStatus: PolicyStatus
  ) => {
    let dialogTitle = '';
    let dialogText = '';
    let yesButtonLabel = '';

    switch (policyStatus) {
      case PolicyStatus.APPROVED:
        dialogTitle = 'Confirm Approval';
        dialogText = 'Are you sure you want to approve this data request?';
        yesButtonLabel = 'Approve';
        break;
      case PolicyStatus.DENIED:
        dialogTitle = 'Confirm Denial';
        dialogText = 'Are you sure you want to deny this data request?';
        yesButtonLabel = 'Deny';
        break;
      default:
        dialogTitle = 'Confirm Status Update';
        dialogText = 'Are you sure you want to update this data request status?';
        yesButtonLabel = 'Confirm';
        break;
    }

    openConfirmationDialog({
      dialogTitle,
      dialogText,
      yesButtonLabel,
      onConfirm: async () => {
        await handleDataRequestStatusUpdate(dataRequestId, policyId, policyStatus);
      }
    });
  };

  /**
   * Open the confirmation dialog for moving a finalized policy back to reviewed.
   *
   * Finalized timeline items call this when the user clicks the approved or denied status button, allowing the policy
   * to be reopened for review after explicit confirmation.
   *
   * @param {string} dataRequestId Identifier of the data request being reset.
   * @param {string} policyId Identifier of the policy tied to the data request.
   * @param {PolicyStatus} currentStatus Current finalized policy status.
   * @returns {void}
   */
  const handleConfirmResetToReviewed = (dataRequestId: string, policyId: string, currentStatus: PolicyStatus) => {
    const currentStatusLabel = `${currentStatus.charAt(0).toUpperCase()}${currentStatus.slice(1)}`;

    openConfirmationDialog({
      dialogTitle: `Reset ${currentStatusLabel} to Reviewed`,
      dialogText: `Are you sure you want to change this status from ${currentStatusLabel} back to Reviewed?`,
      yesButtonLabel: 'Yes',
      onConfirm: async () => {
        await handleDataRequestStatusUpdate(dataRequestId, policyId, PolicyStatus.REVIEWED);
      }
    });
  };

  /**
   * Open the administrative page of a data request.
   *
   * Data-request items call this so users can review what was requested and its policy, which is reached from the
   * data request's page.
   *
   * @param {string} dataRequestId Identifier of the data request to view.
   * @returns {void}
   */
  const handleOpenDataRequestPage = (dataRequestId: string) => {
    navigate(`/admin/data-requests/${dataRequestId}`);
  };

  return {
    updatingDataRequestId,
    handleConfirmDataRequestStatusUpdate,
    handleConfirmResetToReviewed,
    handleOpenDataRequestPage
  };
};
