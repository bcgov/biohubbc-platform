import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EditDialog } from 'components/dialog/EditDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { CustomTimeline, ICustomTimelineItem } from 'components/timeline/CustomTimeline';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { TICKET_TIMELINE_ICONS } from 'constants/icon';
import {
  TICKET_ATTACHMENT_IMAGE_FILE_EXTENSIONS,
  TICKET_ATTACHMENT_MARKDOWN_FORMATTERS,
  TICKET_ATTACHMENT_MARKDOWN_TYPE_BY_MEDIA_TYPE,
  TicketAttachmentMarkdownType
} from 'constants/ticket';
import { IAddPolicyFormValues } from 'features/admin/policies/components/AddPolicyForm';
import { EditPolicyDialog } from 'features/admin/policies/components/EditPolicyDialog';
import { ViewPolicyDialog } from 'features/admin/policies/components/ViewPolicyDialog';
import { transformPolicyJsonToApi } from 'features/admin/policies/utils/policyTransform';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { IPolicy, PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ITicketArtifact, ITicketCommentLog } from 'interfaces/useTicketsApi.interface';
import { useFormikContext } from 'formik';
import { useRef, useState } from 'react';
import { getRelativeTimeLabel } from 'utils/date';
import * as yup from 'yup';
import { TicketCommentForm } from '../comment/TicketCommentForm';
import {
  CommentEvent,
  DataRequestEvent,
  ITicketTimelineProps,
  StatusEvent,
  TimelineEvent
} from './TicketTimeline.interface';
import { TicketCommentTimelineItem } from './item/TicketCommentTimelineItem';
import { TicketDataRequestTimelineItem } from './item/TicketDataRequestTimelineItem';

interface ITicketCommentEditFormValues {
  comment: string;
}

const TicketCommentEditFormYupSchema = yup.object().shape({
  comment: yup.string().trim().required('Comment is required').max(3000, 'Comment must be 3000 characters or less')
});

interface ITicketCommentEditFormProps {
  artifacts: ITicketArtifact[];
  isSaving: boolean;
  isUploadingAttachment: boolean;
  onUploadAttachment: (file: File, appendMarkdownLink: (markdownLink: string) => void) => Promise<void>;
}

/**
 * Formik adapter for the shared ticket comment editor body.
 *
 * @param {ITicketCommentEditFormProps} props
 * @return {*}
 */
const TicketCommentEditForm = (props: ITicketCommentEditFormProps) => {
  const { artifacts, isSaving, isUploadingAttachment, onUploadAttachment } = props;
  const { values, setFieldValue } = useFormikContext<ITicketCommentEditFormValues>();
  const commentRef = useRef(values.comment);
  commentRef.current = values.comment;

  /**
   * Append attachment markdown returned by the upload flow to the current Formik comment field.
   *
   * This callback is passed into the timeline-level upload handler so that the shared upload logic can add the
   * generated `/artifact/{ticketArtifactId}` markdown reference after the attachment has been persisted. A ref mirrors
   * the current Formik value so multiple attachment uploads append to the latest comment text even when uploads resolve
   * asynchronously.
   *
   * @param {string} markdownLink Markdown image or link syntax for the uploaded ticket artifact.
   * @returns {void}
   */
  const appendMarkdownLink = (markdownLink: string) => {
    const previousComment = commentRef.current;
    const separator = previousComment && !/\s$/.test(previousComment) ? ' ' : '';
    const nextComment = `${previousComment}${separator}${markdownLink}`;
    commentRef.current = nextComment;
    setFieldValue('comment', nextComment);
  };

  return (
    <TicketCommentForm
      comment={values.comment}
      artifacts={artifacts}
      setComment={(comment) => setFieldValue('comment', comment)}
      isSaving={isSaving}
      isUploadingAttachment={isUploadingAttachment}
      onUploadAttachment={(file) => onUploadAttachment(file, appendMarkdownLink)}
    />
  );
};

/**
 * Renders the timeline section for a ticket.
 *
 * @param {ITicketTimelineProps} props
 * @return {*}
 */
export const TicketTimeline = (props: ITicketTimelineProps) => {
  const { ticket, isLoading } = props;
  const api = useApi();
  const config = useConfigContext();
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
  const [selectedComment, setSelectedComment] = useState<ITicketCommentLog | null>(null);
  const [isEditCommentDialogOpen, setIsEditCommentDialogOpen] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isUploadingCommentAttachment, setIsUploadingCommentAttachment] = useState(false);

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

  /**
   * Resolve the markdown rendering type to use for an attachment selected while editing a timeline comment.
   *
   * The browser-provided MIME type is preferred because it is available before the file is uploaded. When a browser or
   * operating system provides no MIME type, the file extension is used as a fallback for common image formats. Unknown
   * files are rendered as standard markdown links.
   *
   * @param {File} file File selected from the edit-comment attachment input.
   * @returns {TicketAttachmentMarkdownType} Markdown formatter key used to generate image or link syntax.
   */
  const getAttachmentMarkdownType = (file: File): TicketAttachmentMarkdownType => {
    const mediaType = file.type.split('/')[0]?.toLowerCase();
    const markdownType = mediaType ? TICKET_ATTACHMENT_MARKDOWN_TYPE_BY_MEDIA_TYPE[mediaType] : undefined;

    if (markdownType) {
      return markdownType;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();

    return extension && TICKET_ATTACHMENT_IMAGE_FILE_EXTENSIONS.has(extension) ? 'image' : 'link';
  };

  /**
   * Build the markdown reference inserted into the edit-comment form for an uploaded ticket artifact.
   *
   * The returned markdown uses the stable `ticket_artifact_id` path expected by `TicketMarkdownContent`, allowing edited
   * comments to preview and later render attachments the same way newly-created comments do.
   *
   * @param {File} file Original selected file, used for the markdown label and type detection.
   * @param {string} ticketArtifactId Stable ticket artifact identifier returned after upload completion.
   * @returns {string} Markdown image or link syntax pointing at `/artifact/{ticketArtifactId}`.
   */
  const getArtifactMarkdownByMimeType = (file: File, ticketArtifactId: string) => {
    const href = `/artifact/${ticketArtifactId}`;
    const markdownType = getAttachmentMarkdownType(file);

    return TICKET_ATTACHMENT_MARKDOWN_FORMATTERS[markdownType](file.name, href);
  };

  /**
   * Upload an attachment selected from the edit-comment dialog and append its markdown reference to the form.
   *
   * This mirrors the new-comment upload flow: validate the configured file-size limit, initialize a ticket upload,
   * stream the file to the presigned object-store URL, complete the upload, update cached ticket artifacts if the
   * artifact is new, then call `appendMarkdownLink` so the edit form includes the uploaded attachment. Failures are
   * surfaced through the shared snackbar and leave the comment body unchanged.
   *
   * @param {File} file File selected by the user in the edit-comment dialog.
   * @param {(markdownLink: string) => void} appendMarkdownLink Callback that inserts the generated artifact markdown
   * into the Formik-backed edit-comment field.
   * @returns {Promise<void>} Resolves when the upload attempt and form insertion have completed.
   */
  const handleEditCommentUploadAttachment = async (file: File, appendMarkdownLink: (markdownLink: string) => void) => {
    const maxTicketAttachmentFileSize = config.MAX_TICKET_ATTACHMENT_FILE_SIZE;

    if (file.size > maxTicketAttachmentFileSize) {
      const maxTicketAttachmentFileSizeMB = Math.round(maxTicketAttachmentFileSize / 1024 / 1024);

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: `Attachment exceeds the ${maxTicketAttachmentFileSizeMB} MB limit.`
      });
      return;
    }

    try {
      setIsUploadingCommentAttachment(true);

      const initializedUpload = await api.tickets.createTicketUpload(ticket.ticket_id, {
        file_name: file.name,
        byte_size: file.size,
        content_type: file.type || 'application/octet-stream'
      });

      const uploadResponse = await fetch(initializedUpload.presigned_upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload attachment.');
      }

      const ticketArtifact = await api.tickets.completeTicketUpload(ticket.ticket_id, initializedUpload.upload_id, {
        status: 'uploaded'
      });
      const markdownLink = getArtifactMarkdownByMimeType(file, ticketArtifact.ticket_artifact_id);

      const latestTicket = ticketDataLoader.data;
      if (latestTicket) {
        ticketDataLoader.setData({
          ...latestTicket,
          artifacts: latestTicket.artifacts.some(
            (artifact) => artifact.ticket_artifact_id === ticketArtifact.ticket_artifact_id
          )
            ? latestTicket.artifacts
            : [...latestTicket.artifacts, ticketArtifact]
        });
      }

      appendMarkdownLink(markdownLink);
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message || 'Failed to upload attachment.'
      });
    } finally {
      setIsUploadingCommentAttachment(false);
    }
  };

  /**
   * Open the edit-comment dialog for the selected timeline comment.
   *
   * The timeline item only passes `ticketCommentId`; this handler resolves the full comment from the currently rendered
   * ticket data and stores it as dialog state. If the comment is no longer present in the ticket cache, the click is
   * ignored because there is no reliable initial value for the edit form.
   *
   * @param {string} ticketCommentId Timeline comment identifier selected from the comment context menu.
   * @returns {void}
   */
  const handleOpenEditCommentDialog = (ticketCommentId: string) => {
    const comment = ticket.comments.find((ticketComment) => ticketComment.ticket_comment_id === ticketCommentId);

    if (!comment) {
      return;
    }

    setSelectedComment(comment);
    setIsEditCommentDialogOpen(true);
  };

  /**
   * Close the edit-comment dialog and clear the selected comment state.
   *
   * The dialog remains open while a save or attachment upload is in progress so the user cannot dismiss the form while
   * an API call is mutating the comment or inserting an attachment reference.
   *
   * @returns {void}
   */
  const handleCloseEditCommentDialog = () => {
    if (isSavingComment || isUploadingCommentAttachment) {
      return;
    }

    setIsEditCommentDialogOpen(false);
    setSelectedComment(null);
  };

  /**
   * Close the delete-comment confirmation dialog.
   *
   * This handler is shared by the confirmation dialog close and cancel actions so the global dialog context is reset
   * without mutating ticket comment state.
   *
   * @returns {void}
   */
  const closeDeleteCommentConfirmationDialog = () => {
    dialogContext.setYesNoDialog({ open: false });
  };

  /**
   * Replace an edited comment in the cached ticket details with the API response.
   *
   * This keeps the timeline synchronized immediately after a successful PUT without requiring a full ticket refresh.
   * If the ticket data is not currently available, no cache mutation is attempted.
   *
   * @param {ITicketCommentLog} updatedComment Comment row returned by the update endpoint.
   * @returns {void}
   */
  const replaceCachedComment = (updatedComment: ITicketCommentLog) => {
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      comments: latestTicket.comments.map((comment) =>
        comment.ticket_comment_id === updatedComment.ticket_comment_id ? updatedComment : comment
      )
    });
  };

  /**
   * Remove a deleted comment from the cached ticket details.
   *
   * This is called only after the DELETE endpoint succeeds, so the cache reflects persisted server state. If the ticket
   * data has not loaded, the function exits without changing local state.
   *
   * @param {string} ticketCommentId Identifier of the comment removed by the API.
   * @returns {void}
   */
  const removeCachedComment = (ticketCommentId: string) => {
    const latestTicket = ticketDataLoader.data;

    if (!latestTicket) {
      return;
    }

    ticketDataLoader.setData({
      ...latestTicket,
      comments: latestTicket.comments.filter((comment) => comment.ticket_comment_id !== ticketCommentId)
    });
  };

  /**
   * Persist the edited comment body from the `EditDialog` form.
   *
   * Formik supplies the current form values when the dialog save button is clicked. The handler trims the comment,
   * ignores invalid empty submissions, calls the administrative PUT endpoint scoped by ticket and comment id, replaces
   * the cached timeline comment with the API response, and closes the dialog. API errors are shown through the shared
   * snackbar and leave the dialog open with the user's current form value.
   *
   * @param {ITicketCommentEditFormValues} values Current Formik values from the edit-comment dialog.
   * @returns {Promise<void>} Resolves after the save attempt has completed.
   */
  const handleSaveEditedComment = async (values: ITicketCommentEditFormValues) => {
    const trimmedComment = values.comment.trim();

    if (!selectedComment || !trimmedComment) {
      return;
    }

    try {
      setIsSavingComment(true);
      const updatedComment = await api.tickets.updateTicketComment(
        ticket.ticket_id,
        selectedComment.ticket_comment_id,
        {
          comment: trimmedComment
        }
      );

      replaceCachedComment(updatedComment);

      setIsEditCommentDialogOpen(false);
      setSelectedComment(null);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSavingComment(false);
    }
  };

  /**
   * Delete a timeline comment after the user confirms the destructive action.
   *
   * This calls the administrative DELETE endpoint with the current ticket id and selected `ticket_comment_id`. The API
   * soft deletes the `ticket_comment` row by setting `record_end_date`; after it succeeds, the comment is removed from
   * the cached timeline so the UI reflects the active server rows. Failures are surfaced through the shared snackbar and
   * the cached timeline remains unchanged.
   *
   * @param {string} ticketCommentId Identifier of the comment selected for deletion.
   * @returns {Promise<void>} Resolves after the delete attempt has completed.
   */
  const handleDeleteComment = async (ticketCommentId: string) => {
    try {
      await api.tickets.deleteTicketComment(ticket.ticket_id, ticketCommentId);
      removeCachedComment(ticketCommentId);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    }
  };

  /**
   * Open a confirmation dialog before deleting a timeline comment.
   *
   * The comment context menu calls this handler instead of deleting immediately. Confirming closes the dialog and then
   * delegates to `handleDeleteComment`; canceling or closing only resets the global confirmation dialog state.
   *
   * @param {string} ticketCommentId Identifier of the comment selected from the context menu.
   * @returns {void}
   */
  const handleConfirmDeleteComment = (ticketCommentId: string) => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete Comment',
      dialogText: 'Are you sure you want to delete this comment?',
      yesButtonLabel: 'Delete',
      noButtonLabel: 'Cancel',
      onClose: closeDeleteCommentConfirmationDialog,
      onNo: closeDeleteCommentConfirmationDialog,
      onYes: async () => {
        closeDeleteCommentConfirmationDialog();
        await handleDeleteComment(ticketCommentId);
      }
    });
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
              ticketCommentId={item.id}
              author={item.user_identifier}
              comment={item.comment}
              artifacts={ticket.artifacts}
              onArtifactLinkClick={handleTicketArtifactDownload}
              onEdit={handleOpenEditCommentDialog}
              onDelete={handleConfirmDeleteComment}
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

      {selectedComment && (
        <EditDialog<ITicketCommentEditFormValues>
          open={isEditCommentDialogOpen}
          dialogTitle="Edit Comment"
          dialogSaveButtonLabel="Save"
          isLoading={isSavingComment}
          maxWidth="md"
          component={{
            element: (
              <TicketCommentEditForm
                artifacts={ticket.artifacts}
                isSaving={isSavingComment}
                isUploadingAttachment={isUploadingCommentAttachment}
                onUploadAttachment={handleEditCommentUploadAttachment}
              />
            ),
            initialValues: {
              comment: selectedComment.comment
            },
            validationSchema: TicketCommentEditFormYupSchema
          }}
          onCancel={handleCloseEditCommentDialog}
          onSave={handleSaveEditedComment}
        />
      )}
    </>
  );
};
