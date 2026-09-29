import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { useId } from 'react';

/**
 * Ticket attachment upload behavior shared by new and edited comments.
 *
 * @returns Ticket attachment upload state and helper.
 */
export const useTicketAttachmentUpload = () => {
  const api = useApi();
  const config = useConfigContext();
  const dialogContext = useDialogContext();
  const queryClient = useQueryClient();
  const { ticketId } = useTicketContext();
  // Scopes the in-flight check below to this hook instance.
  const uploadMutationKey = ['ticket', 'attachment-upload', useId()];

  const uploadMutation = useMutation({
    mutationKey: uploadMutationKey,
    mutationFn: async (file: File): Promise<ITicketArtifact> => {
      const contentType = file.type || 'application/octet-stream';

      const initializedUpload = await api.tickets.createTicketUpload(ticketId, {
        file_name: file.name,
        byte_size: file.size,
        content_type: contentType
      });

      await api.objectStorage.uploadFileToUrl({
        url: initializedUpload.presigned_upload_url,
        file,
        contentType
      });

      return api.tickets.completeTicketUpload(ticketId, initializedUpload.upload_id, { status: 'uploaded' });
    }
  });

  const uploadsInFlight = useIsMutating({ mutationKey: uploadMutationKey });

  /**
   * Whether an upload from this hook is in flight. Read from the client rather than from render state, so a second
   * selection made in the same tick as the first is seen.
   *
   * @returns {boolean} True while any upload started by this hook is running.
   */
  const isUploadInFlight = (): boolean => queryClient.isMutating({ mutationKey: uploadMutationKey }) > 0;

  /**
   * Validates one file against the configured size limit, then uploads it and completes the ticket upload.
   * A failure is reported in the snackbar.
   *
   * @param {File} file File selected by the user.
   * @returns {Promise<ITicketArtifact | null>} Uploaded artifact, or null when validation or the upload fails.
   */
  const uploadFile = async (file: File): Promise<ITicketArtifact | null> => {
    const maxTicketAttachmentFileSize = config.MAX_TICKET_ATTACHMENT_FILE_SIZE;

    if (file.size > maxTicketAttachmentFileSize) {
      const maxTicketAttachmentFileSizeMB = Math.round(maxTicketAttachmentFileSize / 1024 / 1024);

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: `Attachment exceeds the ${maxTicketAttachmentFileSizeMB} MB limit.`
      });
      return null;
    }

    try {
      return await uploadMutation.mutateAsync(file);
    } catch (error) {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (error as Error).message || 'Failed to upload attachment.'
      });
      return null;
    }
  };

  /**
   * Upload a selected file as a ticket attachment.
   *
   * Comment create and edit flows call this before inserting markdown into their respective text fields. The helper
   * validates the configured file-size limit, initializes the ticket upload, uploads the file to object storage through
   * the shared object-storage API, completes the ticket upload, and returns the ticket artifact to the caller. A file
   * chosen while another upload from this hook is in flight is ignored.
   *
   * @param {File} file File selected by the user.
   * @returns {Promise<ITicketArtifact | null>} Uploaded artifact, or null when validation/upload fails or another upload is running.
   */
  const uploadTicketAttachment = (file: File): Promise<ITicketArtifact | null> =>
    isUploadInFlight() ? Promise.resolve(null) : uploadFile(file);

  /**
   * Upload several selected files as ticket attachments at once. Each file is validated and uploaded on its own, so one
   * failure does not stop the others. A selection made while another upload from this hook is in flight is ignored.
   *
   * @param {File[]} files Files selected by the user.
   * @returns {Promise<ITicketArtifact[]>} The artifacts that uploaded; empty when none did or another upload is running.
   */
  const uploadTicketAttachments = async (files: File[]): Promise<ITicketArtifact[]> => {
    if (isUploadInFlight()) {
      return [];
    }

    const artifacts = await Promise.all(files.map(uploadFile));
    return artifacts.filter((artifact): artifact is ITicketArtifact => artifact !== null);
  };

  return {
    isUploadingAttachment: uploadsInFlight > 0,
    uploadTicketAttachment,
    uploadTicketAttachments
  };
};
