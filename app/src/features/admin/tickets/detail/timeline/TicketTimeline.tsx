import { EditDialog } from 'components/dialog/EditDialog';
import { EditPolicyDialog } from 'features/admin/policies/components/EditPolicyDialog';
import { ViewPolicyDialog } from 'features/admin/policies/components/ViewPolicyDialog';
import { TicketCommentEditForm } from './comment/edit/TicketCommentEditForm';
import { ITicketCommentEditFormValues } from './comment/edit/TicketCommentEditForm.interface';
import { TicketCommentEditFormYupSchema } from './comment/edit/TicketCommentEditFormYupSchema';
import { useTicketTimelineCommentActions } from './hooks/comment/useTicketTimelineCommentActions';
import { useTicketTimelineDataRequestActions } from './hooks/data-request/useTicketTimelineDataRequestActions';
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
    isViewPolicyDialogOpen,
    selectedPolicy,
    viewPolicy,
    isLoadingPolicy,
    isSavingPolicy,
    handleConfirmDataRequestStatusUpdate,
    handleConfirmResetToReviewed,
    handleOpenPolicyDialog,
    handleOpenViewPolicyDialog,
    handleClosePolicyDialog,
    handleCloseViewPolicyDialog,
    handleSavePolicy
  } = useTicketTimelineDataRequestActions();

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
        onViewFinalizedPolicy={handleOpenViewPolicyDialog}
        onConfirmDataRequestStatusUpdate={handleConfirmDataRequestStatusUpdate}
        onConfirmResetToReviewed={handleConfirmResetToReviewed}
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
