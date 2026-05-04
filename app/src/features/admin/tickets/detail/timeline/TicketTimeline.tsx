import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { CustomTimeline, ICustomTimelineItem } from 'components/timeline/CustomTimeline';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { TICKET_TIMELINE_ICONS } from 'constants/icon';
import { IAddPolicyFormValues } from 'features/admin/policies/components/AddPolicyForm';
import { EditPolicyDialog } from 'features/admin/policies/components/EditPolicyDialog';
import { ViewPolicyDialog } from 'features/admin/policies/components/ViewPolicyDialog';
import { transformPolicyJsonToApi } from 'features/admin/policies/utils/policyTransform';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { IPolicy, PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { getRelativeTimeLabel } from 'utils/date';
import {
  CommentEvent,
  DataRequestEvent,
  ITicketTimelineProps,
  StatusEvent,
  TimelineEvent
} from './TicketTimeline.interface';
import { TicketCommentTimelineItem } from './item/TicketCommentTimelineItem';
import { TicketDataRequestTimelineItem } from './item/TicketDataRequestTimelineItem';

/**
 * Renders the timeline section for a ticket.
 *
 * @param {ITicketTimelineProps} props
 * @return {*}
 */
export const TicketTimeline = (props: ITicketTimelineProps) => {
  const { ticket, isLoading } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const [updatingDataRequestId, setUpdatingDataRequestId] = useState<string | null>(null);
  const [isEditPolicyDialogOpen, setIsEditPolicyDialogOpen] = useState(false);
  const [isViewPolicyDialogOpen, setIsViewPolicyDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<IPolicy | null>(null);
  const [selectedDataRequestId, setSelectedDataRequestId] = useState<string | null>(null);
  const [viewPolicy, setViewPolicy] = useState<IPolicy | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  const closeDataRequestStatusConfirmationDialog = () => {
    dialogContext.setYesNoDialog({ open: false });
  };

  const timelineEvents: TimelineEvent[] = [
    ...ticket.statuses.map(
      (status): StatusEvent => ({
        kind: 'status',
        id: status.ticket_status_id,
        create_date: status.create_date,
        user_identifier: status.user_identifier,
        status: status.status
      })
    ),
    ...ticket.comments.map(
      (comment): CommentEvent => ({
        kind: 'comment',
        id: comment.ticket_comment_id,
        create_date: comment.create_date,
        user_identifier: comment.user_identifier,
        comment: comment.comment
      })
    ),
    ...ticket.data_requests.map(
      (dataRequest): DataRequestEvent => ({
        kind: 'data_request',
        id: dataRequest.data_request_id,
        create_date: dataRequest.create_date ?? '',
        data_request: dataRequest
      })
    )
  ].toSorted((a, b) => new Date(a.create_date).getTime() - new Date(b.create_date).getTime());

  if (!timelineEvents.length) {
    return null;
  }

  // The first "open" status is "opened"; later "open" statuses are "reopened".
  const firstOpenStatusIndex = timelineEvents.findIndex((item) => item.kind === 'status' && item.status === 'open');

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

  const handleTicketArtifactDownload = async (artifact: ITicketArtifact) => {
    const artifactWindow = window.open('', '_blank');

    if (artifactWindow) {
      artifactWindow.opener = null;
    }

    try {
      const response = await api.tickets.getTicketArtifactDownloadUrl(ticket.ticket_id, artifact.ticket_artifact_id);

      if (!artifactWindow) {
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Unable to open attachment. Please allow pop-ups for this site.'
        });
        return;
      }

      artifactWindow.location.href = response.signed_url;
    } catch (error) {
      artifactWindow?.close();

      const apiError = error as APIError;

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message || 'Failed to download attachment.'
      });
    }
  };

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

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle,
      dialogText,
      yesButtonLabel,
      noButtonLabel: 'Cancel',
      onClose: closeDataRequestStatusConfirmationDialog,
      onNo: closeDataRequestStatusConfirmationDialog,
      onYes: async () => {
        closeDataRequestStatusConfirmationDialog();
        await handleDataRequestStatusUpdate(dataRequestId, policyId, policyStatus);
      }
    });
  };

  const handleConfirmResetToReviewed = (dataRequestId: string, policyId: string, currentStatus: PolicyStatus) => {
    const currentStatusLabel = `${currentStatus.charAt(0).toUpperCase()}${currentStatus.slice(1)}`;

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: `Reset ${currentStatusLabel} to Reviewed`,
      dialogText: `Are you sure you want to change this status from ${currentStatusLabel} back to Reviewed?`,
      yesButtonLabel: 'Yes',
      noButtonLabel: 'Cancel',
      onClose: closeDataRequestStatusConfirmationDialog,
      onNo: closeDataRequestStatusConfirmationDialog,
      onYes: async () => {
        closeDataRequestStatusConfirmationDialog();
        await handleDataRequestStatusUpdate(dataRequestId, policyId, PolicyStatus.REVIEWED);
      }
    });
  };

  const handleOpenPolicyDialog = async (
    dataRequestId: string,
    policyId: string,
    initialValues?: Partial<IAddPolicyFormValues>
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

  const handleOpenViewPolicyDialog = async (_dataRequestId: string, policyId: string) => {
    try {
      setIsLoadingPolicy(true);
      const policy = await api.policies.getPolicy(policyId);
      setViewPolicy(policy);
      setIsViewPolicyDialogOpen(true);
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

  const handleClosePolicyDialog = () => {
    if (isSavingPolicy) {
      return;
    }

    setIsEditPolicyDialogOpen(false);
    setSelectedPolicy(null);
    setSelectedDataRequestId(null);
  };

  const handleCloseViewPolicyDialog = () => {
    if (isLoadingPolicy) {
      return;
    }

    setIsViewPolicyDialogOpen(false);
    setViewPolicy(null);
  };

  const handleSavePolicy = async (values: IAddPolicyFormValues) => {
    if (!selectedPolicy || !selectedDataRequestId) {
      return;
    }

    try {
      setIsSavingPolicy(true);

      const statements = transformPolicyJsonToApi(values.policy_json);
      const updatedPolicy = await api.policies.updatePolicy(selectedPolicy.policy_id, {
        name: values.name,
        description: values.description || undefined,
        status: values.status,
        statements
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

  const timelineItems: ICustomTimelineItem[] = timelineEvents.map((item, index) => {
    switch (item.kind) {
      case 'data_request':
        return {
          id: item.id,
          icon: <Icon path={TICKET_TIMELINE_ICONS.data_request} size={0.75} />,
          children: (
            <TicketDataRequestTimelineItem
              dataRequest={item.data_request}
              dateLabel={
                getRelativeTimeLabel(item.create_date ?? '', {
                  maxRelativeDays: 30,
                  absoluteFormat: DATE_FORMAT.ShortMediumDateFormat
                }) ?? ''
              }
              isUpdating={updatingDataRequestId === item.data_request.data_request_id}
              onViewPolicy={handleOpenPolicyDialog}
              onViewFinalizedPolicy={handleOpenViewPolicyDialog}
              onApprove={(dataRequestId) =>
                handleConfirmDataRequestStatusUpdate(dataRequestId, item.data_request.policy_id, PolicyStatus.APPROVED)
              }
              onDeny={(dataRequestId) =>
                handleConfirmDataRequestStatusUpdate(dataRequestId, item.data_request.policy_id, PolicyStatus.DENIED)
              }
              onResetToReviewed={(dataRequestId) =>
                handleConfirmResetToReviewed(dataRequestId, item.data_request.policy_id, item.data_request.status)
              }
            />
          )
        };

      case 'comment':
        return {
          id: item.id,
          icon: <Icon path={TICKET_TIMELINE_ICONS.comment} size={0.75} />,
          children: (
            <TicketCommentTimelineItem
              author={item.user_identifier}
              comment={item.comment}
              artifacts={ticket.artifacts}
              onArtifactLinkClick={handleTicketArtifactDownload}
              dateLabel={
                getRelativeTimeLabel(item.create_date, {
                  maxRelativeDays: 30,
                  absoluteFormat: DATE_FORMAT.ShortMediumDateFormat
                }) ?? ''
              }
            />
          )
        };

      case 'status': {
        const isFirstOpenStatus = index === firstOpenStatusIndex;
        let message = `${item.user_identifier} reopened the ticket`;

        if (item.status === 'closed') {
          message = `${item.user_identifier} closed the ticket`;
        } else if (isFirstOpenStatus) {
          message = `${item.user_identifier} opened the ticket`;
        }

        const statusKey: 'open' | 'closed' = item.status === 'closed' ? 'closed' : 'open';

        return {
          id: item.id,
          icon: <Icon path={TICKET_TIMELINE_ICONS[statusKey]} size={0.75} />,
          children: (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{message}</Typography>
              <Typography variant="body2" color="text.secondary">
                {getRelativeTimeLabel(item.create_date, {
                  maxRelativeDays: 30,
                  absoluteFormat: DATE_FORMAT.ShortMediumDateFormat
                })}
              </Typography>
            </Box>
          )
        };
      }
    }
  });

  return (
    <>
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={
          <Stack gap={1.5}>
            <Skeleton variant="rounded" height={52} />
            <Skeleton variant="rounded" height={52} />
          </Stack>
        }>
        <CustomTimeline items={timelineItems} />
      </LoadingGuard>

      {selectedPolicy && (
        <EditPolicyDialog
          open={isEditPolicyDialogOpen}
          isLoading={isLoadingPolicy || isSavingPolicy}
          policy={selectedPolicy}
          onCancel={handleClosePolicyDialog}
          onSave={handleSavePolicy}
        />
      )}

      {viewPolicy && (
        <ViewPolicyDialog open={isViewPolicyDialogOpen} policy={viewPolicy} onClose={handleCloseViewPolicyDialog} />
      )}
    </>
  );
};
