import { EditDialog } from 'components/dialog/EditDialog';
import { SYSTEM_ROLE } from 'constants/roles';
import { EditPolicyDialog } from 'features/admin/policies/components/EditPolicyDialog';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { hasAtLeastOneValidValue } from 'utils/authUtils';
import { TicketCommentEditForm } from './comment/edit/TicketCommentEditForm';
import { ITicketCommentEditFormValues } from './comment/edit/TicketCommentEditForm.interface';
import { TicketCommentEditFormYupSchema } from './comment/edit/TicketCommentEditFormYupSchema';
import { useTicketTimelineCommentActions } from './hooks/comment/useTicketTimelineCommentActions';
import { useTicketTimelineDataRequestActions } from './hooks/data-request/useTicketTimelineDataRequestActions';
import { useSubmissionUploadStatusHistory } from './hooks/upload/useSubmissionUploadStatusHistory';
import { useTicketTimelineUploadActions } from './hooks/upload/useTicketTimelineUploadActions';
import { TicketTimelineItems } from './item/TicketTimelineItems';
import { ITicketTimelineProps } from './TicketTimeline.interface';

/**
 * Renders the timeline section for a ticket.
 *
 * Shared by the admin ticket page and the portal ticket page. The upload processing history comes
 * from an admin-only endpoint, so the status row is expandable only for system administrators;
 * every other viewer sees the current status alone.
 *
 * @param {ITicketTimelineProps} props
 * @return {*}
 */
export const TicketTimeline = (props: ITicketTimelineProps) => {
  const { ticket, isLoading } = props;
  const {
    selectedComment,
    isEditCommentDialogOpen,
    isSavingComment,
    isUploadingCommentAttachment,
    handleTicketArtifactDownload,
    handleEditCommentUploadAttachment,
    handleOpenEditCommentDialog,
    handleCloseEditCommentDialog,
    handleSaveEditedComment,
    handleConfirmDeleteComment
  } = useTicketTimelineCommentActions();
  const {
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
  } = useTicketTimelineDataRequestActions();
  const {
    handleRequestSubmissionUploadReview,
    handleUpdateSubmissionUploadReview,
    handleConfirmSubmissionUploadDecisionUpdate,
    handleConfirmSubmissionUploadDecisionReset
  } = useTicketTimelineUploadActions();
  const { statusHistoryByUploadId, loadStatusHistory } = useSubmissionUploadStatusHistory();
  const authStateContext = useAuthStateContext();
  const canViewSubmissionUploadStatusHistory = hasAtLeastOneValidValue(
    [SYSTEM_ROLE.SYSTEM_ADMIN],
    authStateContext.biohubUserWrapper.roleNames
  );

  return (
    <>
      <TicketTimelineItems
        ticket={ticket}
        isLoading={isLoading}
        updatingDataRequestId={updatingDataRequestId}
        onArtifactLinkClick={handleTicketArtifactDownload}
        onEditComment={handleOpenEditCommentDialog}
        onDeleteComment={handleConfirmDeleteComment}
        onViewPolicy={handleOpenPolicyDialog}
        onViewFinalizedPolicy={handleOpenPolicyDetailPage}
        onConfirmDataRequestStatusUpdate={handleConfirmDataRequestStatusUpdate}
        onConfirmResetToReviewed={handleConfirmResetToReviewed}
        canViewSubmissionUploadStatusHistory={canViewSubmissionUploadStatusHistory}
        submissionUploadStatusHistoryByUploadId={statusHistoryByUploadId}
        onLoadSubmissionUploadStatusHistory={loadStatusHistory}
        onRequestSubmissionUploadReview={handleRequestSubmissionUploadReview}
        onUpdateSubmissionUploadReview={handleUpdateSubmissionUploadReview}
        onConfirmSubmissionUploadDecisionUpdate={handleConfirmSubmissionUploadDecisionUpdate}
        onConfirmSubmissionUploadDecisionReset={handleConfirmSubmissionUploadDecisionReset}
      />

      {selectedPolicy && (
        <EditPolicyDialog
          open={isEditPolicyDialogOpen}
          isLoading={isLoadingPolicy || isSavingPolicy}
          policy={selectedPolicy}
          onCancel={handleClosePolicyDialog}
          onSave={handleSavePolicy}
        />
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
