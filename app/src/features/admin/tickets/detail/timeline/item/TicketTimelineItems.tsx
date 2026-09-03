import Icon from '@mdi/react';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { CustomTimeline, ICustomTimelineItem } from 'components/timeline/CustomTimeline';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { TICKET_TIMELINE_ICONS } from 'constants/icon';
import { IPolicyFormValues } from 'features/admin/policies/components/PolicyForm.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import {
  ITicketArtifact,
  ITicketExtended,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewTaskStatus,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';
import { getRelativeTimeLabel } from 'utils/date';
import { SubmissionUploadStatusHistoryState } from '../hooks/upload/useSubmissionUploadStatusHistory';
import { CommentEvent, DataRequestEvent, StatusEvent, TimelineEvent, UploadEvent } from '../TicketTimeline.interface';
import { TicketTimelineCommentItem } from './comment/TicketTimelineCommentItem';
import { TicketTimelineDataRequestItem } from './data-request/TicketTimelineDataRequestItem';
import { TicketTimelineStatusItem } from './status/TicketTimelineStatusItem';
import { TicketUploadTimelineItem } from './TicketUploadTimelineItem';

interface ITicketTimelineItemsProps {
  ticket: ITicketExtended;
  isLoading: boolean;
  updatingDataRequestId: string | null;
  onArtifactLinkClick: (artifact: ITicketArtifact) => Promise<void>;
  onEditComment: (ticketCommentId: string) => void;
  onDeleteComment: (ticketCommentId: string) => void;
  onViewPolicy: (dataRequestId: string, policyId: string, initialValues?: Partial<IPolicyFormValues>) => void;
  onViewFinalizedPolicy: (dataRequestId: string, policyId: string) => void;
  onConfirmDataRequestStatusUpdate: (dataRequestId: string, policyId: string, policyStatus: PolicyStatus) => void;
  onConfirmResetToReviewed: (dataRequestId: string, policyId: string, currentStatus: PolicyStatus) => void;
  submissionUploadStatusHistoryByUploadId: Record<string, SubmissionUploadStatusHistoryState>;
  onLoadSubmissionUploadStatusHistory: (upload: TicketSubmissionUploadResponse) => void;
  onRequestSubmissionUploadReview: (upload: TicketSubmissionUploadResponse, scope: SubmissionUploadReviewScope) => void;
  onUpdateSubmissionUploadReview: (
    upload: TicketSubmissionUploadResponse,
    review: TicketSubmissionUploadReviewResponse,
    status: SubmissionUploadReviewTaskStatus
  ) => void;
  onConfirmSubmissionUploadReviewStatusUpdate: (
    upload: TicketSubmissionUploadResponse,
    status: 'approved' | 'denied'
  ) => void;
  onConfirmSubmissionUploadReviewStatusReset: (upload: TicketSubmissionUploadResponse) => void;
}

/**
 * Render the sorted ticket timeline events as concrete timeline items.
 *
 * @param {ITicketTimelineItemsProps} props Component props.
 * @return {*}
 */
export const TicketTimelineItems = (props: ITicketTimelineItemsProps) => {
  const {
    ticket,
    isLoading,
    updatingDataRequestId,
    onArtifactLinkClick,
    onEditComment,
    onDeleteComment,
    onViewPolicy,
    onViewFinalizedPolicy,
    onConfirmDataRequestStatusUpdate,
    onConfirmResetToReviewed,
    submissionUploadStatusHistoryByUploadId,
    onLoadSubmissionUploadStatusHistory,
    onRequestSubmissionUploadReview,
    onUpdateSubmissionUploadReview,
    onConfirmSubmissionUploadReviewStatusUpdate,
    onConfirmSubmissionUploadReviewStatusReset
  } = props;

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
        comment: comment.comment,
        artifacts: comment.artifacts
      })
    ),
    ...ticket.data_requests.map(
      (dataRequest): DataRequestEvent => ({
        kind: 'data_request',
        id: dataRequest.data_request_id,
        create_date: dataRequest.create_date ?? '',
        data_request: dataRequest
      })
    ),
    ...ticket.submission_uploads.map(
      (upload): UploadEvent => ({
        kind: 'upload',
        id: `${upload.submission_uuid}-${upload.submission_upload_id}`,
        create_date: upload.create_date,
        upload
      })
    )
  ].toSorted((a, b) => new Date(a.create_date).getTime() - new Date(b.create_date).getTime());

  if (!timelineEvents.length) {
    return null;
  }

  // The first "open" status is "opened"; later "open" statuses are "reopened".
  const firstOpenStatusIndex = timelineEvents.findIndex((item) => item.kind === 'status' && item.status === 'open');

  const timelineItems: ICustomTimelineItem[] = timelineEvents.map((item, index) => {
    switch (item.kind) {
      case 'data_request':
        return {
          id: item.id,
          icon: <Icon path={TICKET_TIMELINE_ICONS.data_request} size={0.75} />,
          children: (
            <TicketTimelineDataRequestItem
              dataRequest={item.data_request}
              dateLabel={
                getRelativeTimeLabel(item.create_date ?? '', {
                  maxRelativeDays: 30,
                  absoluteFormat: DATE_FORMAT.ShortMediumDateFormat
                }) ?? ''
              }
              isUpdating={updatingDataRequestId === item.data_request.data_request_id}
              onViewPolicy={onViewPolicy}
              onViewFinalizedPolicy={onViewFinalizedPolicy}
              onApprove={(dataRequestId) =>
                onConfirmDataRequestStatusUpdate(dataRequestId, item.data_request.policy_id, PolicyStatus.APPROVED)
              }
              onDeny={(dataRequestId) =>
                onConfirmDataRequestStatusUpdate(dataRequestId, item.data_request.policy_id, PolicyStatus.DENIED)
              }
              onResetToReviewed={(dataRequestId) =>
                onConfirmResetToReviewed(dataRequestId, item.data_request.policy_id, item.data_request.status)
              }
            />
          )
        };

      case 'upload':
        return {
          id: item.id,
          icon: <Icon path={TICKET_TIMELINE_ICONS.upload} size={0.75} />,
          children: (
            <TicketUploadTimelineItem
              upload={item.upload}
              dateLabel={
                getRelativeTimeLabel(item.create_date, {
                  maxRelativeDays: 30,
                  absoluteFormat: DATE_FORMAT.ShortMediumDateFormat
                }) ?? ''
              }
              statusHistory={submissionUploadStatusHistoryByUploadId[item.upload.submission_upload_id]}
              onLoadStatusHistory={onLoadSubmissionUploadStatusHistory}
              onRequestReview={onRequestSubmissionUploadReview}
              onUpdateReview={onUpdateSubmissionUploadReview}
              onAccept={(upload) => onConfirmSubmissionUploadReviewStatusUpdate(upload, 'approved')}
              onReject={(upload) => onConfirmSubmissionUploadReviewStatusUpdate(upload, 'denied')}
              onResetDecision={onConfirmSubmissionUploadReviewStatusReset}
            />
          )
        };

      case 'comment':
        return {
          id: item.id,
          icon: <Icon path={TICKET_TIMELINE_ICONS.comment} size={0.75} />,
          children: (
            <TicketTimelineCommentItem
              ticketCommentId={item.id}
              author={item.user_identifier}
              comment={item.comment}
              artifacts={item.artifacts}
              onArtifactLinkClick={onArtifactLinkClick}
              onEdit={onEditComment}
              onDelete={onDeleteComment}
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
        const getStatusMessage = () => {
          if (item.status === 'closed') {
            return `${item.user_identifier} closed the ticket`;
          }

          return `${item.user_identifier} ${isFirstOpenStatus ? 'opened' : 'reopened'} the ticket`;
        };

        const statusKey: 'open' | 'closed' = item.status === 'closed' ? 'closed' : 'open';

        return {
          id: item.id,
          icon: <Icon path={TICKET_TIMELINE_ICONS[statusKey]} size={0.75} />,
          children: (
            <TicketTimelineStatusItem
              message={getStatusMessage()}
              dateLabel={
                getRelativeTimeLabel(item.create_date, {
                  maxRelativeDays: 30,
                  absoluteFormat: DATE_FORMAT.ShortMediumDateFormat
                }) ?? ''
              }
            />
          )
        };
      }
    }
  });

  return (
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
  );
};
