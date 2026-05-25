import { getArtifactMarkdownByMimeType } from 'features/admin/tickets/utils/ticketArtifactMarkdown';
import { useTicketAttachmentUpload } from 'features/admin/tickets/hooks/useTicketAttachmentUpload';
import { useTicketCommentCache } from 'features/admin/tickets/hooks/useTicketCommentCache';
import { downloadTicketArtifact } from 'features/admin/tickets/utils/ticketArtifactDownload';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketArtifact, ITicketCommentLog } from 'interfaces/useTicketsApi.interface';
import { useRef, useState } from 'react';
import { useTicketTimelineConfirmationDialog } from '../useTicketTimelineConfirmationDialog';
import { ITicketCommentEditFormValues } from '../../comment/edit/TicketCommentEditForm.interface';

/**
 * Comment edit, delete, download, and upload handlers for the ticket timeline.
 *
 * @returns Timeline comment action state and handlers.
 */
export const useTicketTimelineCommentActions = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const { openConfirmationDialog } = useTicketTimelineConfirmationDialog();
  const { removeCachedComment, replaceCachedComment } = useTicketCommentCache();
  const { isUploadingAttachment: isUploadingCommentAttachment, uploadTicketAttachment } = useTicketAttachmentUpload();
  const [selectedComment, setSelectedComment] = useState<ITicketCommentLog | null>(null);
  const [editCommentArtifacts, setEditCommentArtifacts] = useState<ITicketArtifact[]>([]);
  const [isEditCommentDialogOpen, setIsEditCommentDialogOpen] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const isSavingCommentRef = useRef(false);
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
    await downloadTicketArtifact({
      ticketId,
      artifact,
      getDownloadUrl: api.tickets.getTicketArtifactDownloadUrl,
      setSnackbar: dialogContext.setSnackbar
    });
  };

  /**
   * Upload an attachment selected from the edit-comment dialog and append its markdown reference to the form.
   *
   * The edit form passes `appendMarkdownLink` so this hook can reuse the ticket upload flow while letting Formik own the
   * comment field. Successful uploads are tracked locally so previews can resolve new links before the edit is saved.
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
    setEditCommentArtifacts((previousArtifacts) =>
      previousArtifacts.some((artifact) => artifact.ticket_artifact_id === ticketArtifact.ticket_artifact_id)
        ? previousArtifacts
        : [...previousArtifacts, ticketArtifact]
    );
    appendMarkdownLink(markdownLink);
  };

  /**
   * Open the edit-comment dialog for the selected timeline comment.
   *
   * Timeline items pass only the comment identifier. This handler resolves the full comment from the current cached
   * ticket so the edit dialog receives stable initial form values, including comments just added to the cache.
   *
   * @param {string} ticketCommentId Timeline comment identifier selected from the context menu.
   * @returns {void}
   */
  const handleOpenEditCommentDialog = (ticketCommentId: string) => {
    const comment = ticketDataLoader.data?.comments.find(
      (ticketComment) => ticketComment.ticket_comment_id === ticketCommentId
    );

    if (!comment) {
      return;
    }

    setSelectedComment(comment);
    setEditCommentArtifacts([]);
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
    setEditCommentArtifacts([]);
  };

  /**
   * Persist the edited comment body from the edit-comment dialog.
   *
   * The dialog calls this on save with Formik values. Empty submissions are ignored, successful saves replace the cached
   * comment, and failures keep the dialog open with the user's current form value. The ref guard prevents duplicate save
   * callbacks from issuing multiple update requests while the first request is still in flight.
   *
   * @param {ITicketCommentEditFormValues} values Current Formik values from the edit-comment dialog.
   * @returns {Promise<void>} Resolves after the save attempt has completed.
   */
  const handleSaveEditedComment = async (values: ITicketCommentEditFormValues) => {
    const trimmedComment = values.comment.trim();

    if (!selectedComment || !trimmedComment || isSavingCommentRef.current) {
      return;
    }

    try {
      isSavingCommentRef.current = true;
      setIsSavingComment(true);
      const updatedComment = await api.tickets.updateTicketComment(ticketId, selectedComment.ticket_comment_id, {
        comment: trimmedComment
      });

      replaceCachedComment(updatedComment.ticket_comment_id, updatedComment);

      setIsEditCommentDialogOpen(false);
      setSelectedComment(null);
      setEditCommentArtifacts([]);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      isSavingCommentRef.current = false;
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
      await api.tickets.deleteTicketComment(ticketId, ticketCommentId);
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
    editCommentArtifacts,
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
