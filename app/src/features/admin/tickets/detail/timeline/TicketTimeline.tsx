import { EditDialog } from 'components/dialog/EditDialog';
import { SYSTEM_ROLE } from 'constants/roles';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { hasAtLeastOneValidValue } from 'utils/authUtils';
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
 * Shared by the admin ticket page and the portal ticket page. The upload processing history comes
 * from an admin-only endpoint, so the status row is expandable only for system administrators;
 * every other viewer sees the current status alone. Tag history is administrative too: the timeline
 * shows the tag events its page passes in, and loads none itself.
 *
 * @param {ITicketTimelineProps} props
 * @return {*}
 */
export const TicketTimeline = (props: ITicketTimelineProps) => {
  const { ticket, tagEvents } = props;
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
    handleConfirmDataRequestStatusUpdate,
    handleConfirmResetToReviewed,
    handleOpenDataRequestPage
  } = useTicketTimelineDataRequestActions();
  const {
    handleCreateSubmissionUploadReview,
    handleOpenSubmissionUploadReview,
    handleConfirmSubmissionUploadDecisionUpdate,
    handleConfirmSubmissionUploadDecisionReset
  } = useTicketTimelineUploadActions();
  const authStateContext = useAuthStateContext();
  const canViewSubmissionUploadStatusHistory = hasAtLeastOneValidValue(
    [SYSTEM_ROLE.SYSTEM_ADMIN],
    authStateContext.biohubUserWrapper.roleNames
  );

  return (
    <>
      <TicketTimelineItems
        ticket={ticket}
        tagEvents={tagEvents}
        updatingDataRequestId={updatingDataRequestId}
        onArtifactLinkClick={handleTicketArtifactDownload}
        onEditComment={handleOpenEditCommentDialog}
        onDeleteComment={handleConfirmDeleteComment}
        onViewRequest={handleOpenDataRequestPage}
        onConfirmDataRequestStatusUpdate={handleConfirmDataRequestStatusUpdate}
        onConfirmResetToReviewed={handleConfirmResetToReviewed}
        canViewSubmissionUploadStatusHistory={canViewSubmissionUploadStatusHistory}
        onCreateSubmissionUploadReview={handleCreateSubmissionUploadReview}
        onOpenSubmissionUploadReview={handleOpenSubmissionUploadReview}
        onConfirmSubmissionUploadDecisionUpdate={handleConfirmSubmissionUploadDecisionUpdate}
        onConfirmSubmissionUploadDecisionReset={handleConfirmSubmissionUploadDecisionReset}
      />

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
