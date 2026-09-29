import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  const uploadTicketAttachment = async (file: File): Promise<ITicketArtifact | null> => {
    if (queryClient.isMutating({ mutationKey: uploadMutationKey }) > 0) {
      return null;
    }

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

  return {
    isUploadingAttachment: uploadMutation.isPending,
    uploadTicketAttachment
  };
};
