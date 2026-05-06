import { getArtifactMarkdownByMimeType } from 'features/admin/tickets/utils/ticketArtifactMarkdown';
import { useTicketAttachmentUpload } from 'features/admin/tickets/hooks/useTicketAttachmentUpload';
import { useTicketCommentCache } from 'features/admin/tickets/hooks/useTicketCommentCache';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ITicketArtifact, ITicketCommentLog, ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { useRef, useState } from 'react';
import { useTicketTimelineConfirmationDialog } from '../useTicketTimelineConfirmationDialog';
import { ITicketCommentEditFormValues } from '../../comment/edit/TicketCommentEditForm.interface';

interface IUseTicketTimelineCommentActionsProps {
  ticket: ITicketExtended;
}

/**
 * Comment edit, delete, download, and upload handlers for the ticket timeline.
 *
 * @param {IUseTicketTimelineCommentActionsProps} props Hook props.
 * @returns Timeline comment action state and handlers.
 */
export const useTicketTimelineCommentActions = (props: IUseTicketTimelineCommentActionsProps) => {
  const { ticket } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { openConfirmationDialog } = useTicketTimelineConfirmationDialog();
  const { removeCachedComment, replaceCachedComment } = useTicketCommentCache();
  const { isUploadingAttachment: isUploadingCommentAttachment, uploadTicketAttachment } = useTicketAttachmentUpload({
    ticketId: ticket.ticket_id
  });
  const [selectedComment, setSelectedComment] = useState<ITicketCommentLog | null>(null);
  const [isEditCommentDialogOpen, setIsEditCommentDialogOpen] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const isDeletingCommentRef = useRef(false);

  /**
   * Open a ticket attachment in a new browser tab.
   *
   * The timeline markdown renderer calls this when a user clicks an artifact reference. A blank window is opened before
   * the async signed URL request so popup blockers still allow the navigation.
   *
   * @param {ITicketArtifact} artifact Ticket artifact selected from timeline markdown.
   * @returns {Promise<void>} Resolves after the signed URL is assigned or an error is shown.
   */
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
   * Upload an attachment selected from the edit-comment dialog and append its markdown reference to the form.
   *
   * The edit form passes `appendMarkdownLink` so this hook can reuse the ticket upload flow while letting Formik own the
   * comment field. Successful uploads also patch the cached ticket artifact list so previews can resolve the new link.
   *
   * @param {File} file File selected by the user in the edit-comment dialog.
   * @param {(markdownLink: string) => void} appendMarkdownLink Callback that inserts markdown into the edit form.
   * @returns {Promise<void>} Resolves when the upload attempt and form insertion have completed.
   */
  const handleEditCommentUploadAttachment = async (file: File, appendMarkdownLink: (markdownLink: string) => void) => {
    const ticketArtifact = await uploadTicketAttachment(file);

    if (!ticketArtifact) {
      return;
    }

    const markdownLink = getArtifactMarkdownByMimeType(file, ticketArtifact.ticket_artifact_id);
    appendMarkdownLink(markdownLink);
  };

  /**
   * Open the edit-comment dialog for the selected timeline comment.
   *
   * Timeline items pass only the comment identifier. This handler resolves the full comment from the rendered ticket so
   * the edit dialog receives stable initial form values.
   *
   * @param {string} ticketCommentId Timeline comment identifier selected from the context menu.
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
   * Close the edit-comment dialog and clear selected comment state.
   *
   * The dialog stays open while a save or attachment upload is active so the user cannot dismiss a form with an
   * in-flight mutation that may still update the comment body.
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
   * Persist the edited comment body from the edit-comment dialog.
   *
   * The dialog calls this on save with Formik values. Empty submissions are ignored, successful saves replace the cached
   * comment, and failures keep the dialog open with the user's current form value.
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

      replaceCachedComment(updatedComment.ticket_comment_id, updatedComment);

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
   * The ref guard prevents duplicate confirmation callbacks from issuing multiple DELETE requests while the first
   * request is still in flight.
   *
   * @param {string} ticketCommentId Identifier of the comment selected for deletion.
   * @returns {Promise<void>} Resolves after the delete attempt has completed.
   */
  const handleDeleteComment = async (ticketCommentId: string) => {
    if (isDeletingCommentRef.current) {
      return;
    }

    try {
      isDeletingCommentRef.current = true;
      await api.tickets.deleteTicketComment(ticket.ticket_id, ticketCommentId);
      removeCachedComment(ticketCommentId);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      isDeletingCommentRef.current = false;
    }
  };

  /**
   * Open a confirmation dialog before deleting a timeline comment.
   *
   * The comment context menu calls this handler instead of deleting immediately. Confirming closes the dialog and
   * delegates to the guarded delete handler.
   *
   * @param {string} ticketCommentId Identifier of the comment selected from the context menu.
   * @returns {void}
   */
  const handleConfirmDeleteComment = (ticketCommentId: string) => {
    openConfirmationDialog({
      dialogTitle: 'Delete Comment',
      dialogText: 'Are you sure you want to delete this comment?',
      yesButtonLabel: 'Delete',
      onConfirm: async () => {
        await handleDeleteComment(ticketCommentId);
      }
    });
  };

  return {
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
  };
};
