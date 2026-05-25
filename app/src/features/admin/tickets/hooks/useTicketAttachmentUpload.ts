import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { useSerializedAsync } from 'hooks/useSerializedAsync';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

/**
 * Ticket attachment upload behavior shared by new and edited comments.
 *
 * @returns Ticket attachment upload state and helper.
 */
export const useTicketAttachmentUpload = () => {
  const api = useApi();
  const config = useConfigContext();
  const dialogContext = useDialogContext();
  const { ticketId } = useTicketContext();
  const { runSerialized } = useSerializedAsync();
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  /**
   * Upload a selected file as a ticket attachment and cache the resulting artifact.
   *
   * Comment create and edit flows call this before inserting markdown into their respective text fields. The helper
   * validates the configured file-size limit, initializes the ticket upload, uploads the file to object storage through
   * the shared object-storage API, completes the ticket upload, and adds the returned artifact to cached ticket details
   * to the caller so comment forms or artifact tables can update their own local state.
   *
   * @param {File} file File selected by the user.
   * @returns {Promise<ITicketArtifact | null>} Uploaded artifact, or null when validation/upload fails.
   */
  const uploadTicketAttachment = async (file: File): Promise<ITicketArtifact | null> => {
    const ticketArtifact = await runSerialized(async () => {
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
        setIsUploadingAttachment(true);

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

        const ticketArtifact = await api.tickets.completeTicketUpload(ticketId, initializedUpload.upload_id, {
          status: 'uploaded'
        });

        return ticketArtifact;
      } catch (caughtError) {
        const apiError = caughtError as APIError;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: apiError.message || 'Failed to upload attachment.'
        });
        return null;
      } finally {
        setIsUploadingAttachment(false);
      }
    });

    return ticketArtifact ?? null;
  };

  return {
    isUploadingAttachment,
    uploadTicketAttachment
  };
};
