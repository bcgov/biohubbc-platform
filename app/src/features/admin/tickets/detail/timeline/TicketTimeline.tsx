import { EditDialog } from 'components/dialog/EditDialog';
import { EditPolicyDialog } from 'features/admin/policies/components/EditPolicyDialog';
import { TicketCommentEditForm } from './comment/edit/TicketCommentEditForm';
import { ITicketCommentEditFormValues } from './comment/edit/TicketCommentEditForm.interface';
import { TicketCommentEditFormYupSchema } from './comment/edit/TicketCommentEditFormYupSchema';
import { useTicketTimelineCommentActions } from './hooks/comment/useTicketTimelineCommentActions';
import { useTicketTimelineDataRequestActions } from './hooks/data-request/useTicketTimelineDataRequestActions';
import { useTicketTimelineUploadActions } from './hooks/upload/useTicketTimelineUploadActions';
import { TicketTimelineItems } from './item/TicketTimelineItems';
import { ITicketTimelineProps } from './TicketTimeline.interface';

/**
 * Renders the timeline section for a ticket.
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
    handleConfirmSubmissionUploadReviewStatusUpdate,
    handleConfirmSubmissionUploadReviewStatusReset
  } = useTicketTimelineUploadActions();

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
        onRequestSubmissionUploadReview={handleRequestSubmissionUploadReview}
        onUpdateSubmissionUploadReview={handleUpdateSubmissionUploadReview}
        onConfirmSubmissionUploadReviewStatusUpdate={handleConfirmSubmissionUploadReviewStatusUpdate}
        onConfirmSubmissionUploadReviewStatusReset={handleConfirmSubmissionUploadReviewStatusReset}
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
