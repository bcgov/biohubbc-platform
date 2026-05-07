import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

interface IUseTicketAttachmentUploadProps {
  ticketId: string;
}

/**
 * Ticket attachment upload behavior shared by new and edited comments.
 *
 * @param {IUseTicketAttachmentUploadProps} props Hook props.
 * @returns Ticket attachment upload state and helper.
 */
export const useTicketAttachmentUpload = (props: IUseTicketAttachmentUploadProps) => {
  const { ticketId } = props;
  const api = useApi();
  const config = useConfigContext();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  /**
   * Upload a selected file as a ticket attachment and cache the resulting artifact.
   *
   * Comment create and edit flows call this before inserting markdown into their respective text fields. The helper
   * validates the configured file-size limit, initializes the ticket upload, uploads the file to object storage through
   * the shared object-storage API, completes the ticket upload, and adds the returned artifact to cached ticket details
   * when it is not already present.
   *
   * @param {File} file File selected by the user.
   * @returns {Promise<ITicketArtifact | null>} Uploaded artifact, or null when validation/upload fails.
   */
  const uploadTicketAttachment = async (file: File): Promise<ITicketArtifact | null> => {
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

      const initializedUpload = await api.tickets.createTicketUpload(ticketId, {
        file_name: file.name,
        byte_size: file.size,
        content_type: file.type
      });

      await api.objectStorage.uploadFileToUrl({
        url: initializedUpload.presigned_upload_url,
        file,
        contentType: file.type
      });

      const ticketArtifact = await api.tickets.completeTicketUpload(ticketId, initializedUpload.upload_id, {
        status: 'uploaded'
      });

      const latestTicket = ticketDataLoader.data;
      if (latestTicket) {
        ticketDataLoader.setData({
          ...latestTicket,
          artifacts: latestTicket.artifacts.some(
            (artifact) => artifact.ticket_artifact_id === ticketArtifact.ticket_artifact_id
          )
            ? latestTicket.artifacts
            : [...latestTicket.artifacts, ticketArtifact]
        });
      }

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
  };

  return {
    isUploadingAttachment,
    uploadTicketAttachment
  };
};
