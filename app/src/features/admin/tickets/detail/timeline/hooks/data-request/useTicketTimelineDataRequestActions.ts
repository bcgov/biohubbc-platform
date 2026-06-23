import { IPolicyFormValues } from 'features/admin/policies/components/PolicyForm';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { IPolicy, PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTicketTimelineConfirmationDialog } from '../useTicketTimelineConfirmationDialog';

/**
 * Data-request status and policy dialog handlers for the ticket timeline.
 *
 * @returns Timeline data-request action state and handlers.
 */
export const useTicketTimelineDataRequestActions = () => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();
  const { openConfirmationDialog } = useTicketTimelineConfirmationDialog();
  const { ticketDataLoader } = useTicketContext();
  const [updatingDataRequestId, setUpdatingDataRequestId] = useState<string | null>(null);
  const [isEditPolicyDialogOpen, setIsEditPolicyDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<IPolicy | null>(null);
  const [selectedDataRequestId, setSelectedDataRequestId] = useState<string | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  /**
   * Persist a data-request policy status transition and patch the cached ticket.
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

      const updatedPolicy = await api.policies.updatePolicyStatus(policyId, {
        status: policyStatus
      });

      const latestTicket = ticketDataLoader.data;
      if (!latestTicket) {
        return;
      }

      ticketDataLoader.setData({
        ...latestTicket,
        data_requests: latestTicket.data_requests.map((dataRequest) =>
          dataRequest.data_request_id === dataRequestId ? { ...dataRequest, status: updatedPolicy.status } : dataRequest
        )
      });
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
   * Open the editable policy dialog for a data request.
   *
   * Data-request items call this for review and view-policy actions that should allow editing. Optional initial values
   * are merged into the fetched policy so requested data requests can enter the dialog as reviewed.
   *
   * @param {string} dataRequestId Identifier of the data request whose policy is being edited.
   * @param {string} policyId Identifier of the policy to fetch.
   * @param {Partial<IPolicyFormValues>} [initialValues] Optional form value overrides.
   * @returns {Promise<void>} Resolves after the policy has loaded or an error has been shown.
   */
  const handleOpenPolicyDialog = async (
    dataRequestId: string,
    policyId: string,
    initialValues?: Partial<IPolicyFormValues>
  ) => {
    try {
      setIsLoadingPolicy(true);
      const policy = await api.policies.getPolicy(policyId);
      setSelectedPolicy({
        ...policy,
        name: initialValues?.name ?? policy.name,
        description: initialValues?.description ?? policy.description,
        status: initialValues?.status ?? policy.status
      });
      setSelectedDataRequestId(dataRequestId);
      setIsEditPolicyDialogOpen(true);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsLoadingPolicy(false);
    }
  };

  /**
   * Open the read-only finalized policy detail page for a data request.
   *
   * Finalized data-request items call this when users need to inspect approved or denied policy details without editing
   * the policy body.
   *
   * @param {string} _dataRequestId Identifier of the data request whose policy is being viewed.
   * @param {string} policyId Identifier of the policy to fetch.
   * @returns {void}
   */
  const handleOpenPolicyDetailPage = (_dataRequestId: string, policyId: string) => {
    navigate(`/admin/policy/${policyId}`);
  };

  /**
   * Close the editable policy dialog and clear selected policy state.
   *
   * The dialog remains open while a save is active so an in-flight policy mutation cannot finish against cleared local
   * selection state.
   *
   * @returns {void}
   */
  const handleClosePolicyDialog = () => {
    if (isSavingPolicy) {
      return;
    }

    setIsEditPolicyDialogOpen(false);
    setSelectedPolicy(null);
    setSelectedDataRequestId(null);
  };

  /**
   * Save edited policy details from the policy dialog.
   *
   * The edit dialog calls this with form values. The handler persists policy metadata, preserves existing statements,
   * patches cached data-request status for the matching policy, and closes the dialog on success.
   *
   * @param {IPolicyFormValues} values Current policy form values.
   * @returns {Promise<void>} Resolves after the save attempt has completed.
   */
  const handleSavePolicy = async (values: IPolicyFormValues) => {
    if (!selectedPolicy || !selectedDataRequestId) {
      return;
    }

    try {
      setIsSavingPolicy(true);

      const updatedPolicy = await api.policies.updatePolicy(selectedPolicy.policy_id, {
        name: values.name,
        description: values.description || undefined,
        status: values.status,
        statements: selectedPolicy.statements.map((statement) => ({
          effect: statement.effect,
          submission_feature_urn: statement.submission_feature_urn,
          ...(statement.policy_expression_id ? { policy_expression_id: statement.policy_expression_id } : {})
        }))
      });

      setSelectedPolicy(updatedPolicy);

      const latestTicket = ticketDataLoader.data;
      if (latestTicket) {
        ticketDataLoader.setData({
          ...latestTicket,
          data_requests: latestTicket.data_requests.map((dataRequest) =>
            dataRequest.policy_id === updatedPolicy.policy_id
              ? { ...dataRequest, status: updatedPolicy.status }
              : dataRequest
          )
        });
      }

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Updated policy'
      });

      setIsEditPolicyDialogOpen(false);
      setSelectedPolicy(null);
      setSelectedDataRequestId(null);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingPolicy(false);
    }
  };

  return {
    updatingDataRequestId,
    isEditPolicyDialogOpen,
    selectedPolicy,
    isLoadingPolicy,
    isSavingPolicy,
    handleConfirmDataRequestStatusUpdate,
    handleConfirmResetToReviewed,
    handleOpenPolicyDialog,
    handleOpenPolicyDetailPage,
    handleClosePolicyDialog,
    handleSavePolicy
  };
};
