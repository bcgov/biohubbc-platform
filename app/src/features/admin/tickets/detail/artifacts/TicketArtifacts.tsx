import { mdiPlus } from '@mdi/js';
import axios from 'axios';
import { PageSection } from 'components/section/PageSection';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IGetTicketArtifactsResponse, ITicketArtifact, ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { useCallback, useState } from 'react';
import { TicketCommentArtifactUpload } from '../comment/TicketCommentArtifactUpload';
import { TicketArtifactsTable } from './table/TicketArtifactsTable';

interface ITicketArtifactsProps {
  ticket: ITicketExtended;
}

/**
 * Artifacts panel for ticket attachments.
 *
 * @param {ITicketArtifactsProps} props
 * @return {*}
 */
export const TicketArtifacts = (props: ITicketArtifactsProps) => {
  const { ticket } = props;
  const api = useApi();
  const config = useConfigContext();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const [isUploading, setIsUploading] = useState(false);
  const ticketArtifactsGrid = useServerPaginatedDataGrid<ITicketArtifact, IGetTicketArtifactsResponse>({
    fetcher: (_search, pagination) => api.tickets.getTicketArtifacts(ticket.ticket_id, pagination),
    extractData: (response) => response.artifacts,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'create_date', sort: 'desc' }
  });

  /**
   * Builds markdown that references a ticket artifact by ticket_artifact_id.
   *
   * Used by the copy action so the generated text can be pasted directly into a ticket comment and later rendered as an
   * artifact link.
   */
  const getArtifactMarkdown = useCallback(
    (artifact: ITicketArtifact) =>
      `[${artifact.key.split('/').pop() || artifact.key}](/artifact/${artifact.ticket_artifact_id})`,
    []
  );

  /**
   * Opens a ticket artifact in a new tab using a short-lived signed download URL.
   *
   * Used by the row download action. The blank tab is opened before the async API call so browsers do not block it as an
   * unsolicited pop-up, then redirected once the signed URL is available.
   */
  const handleDownloadArtifact = useCallback(
    async (artifact: ITicketArtifact) => {
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
      } catch (caughtError) {
        artifactWindow?.close();

        const apiError = caughtError as APIError;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: apiError.message || 'Failed to download attachment.'
        });
      }
    },
    [api.tickets, dialogContext, ticket.ticket_id]
  );

  /**
   * Copies artifact markdown to the user's clipboard.
   *
   * Used by the row copy action to support the workflow of copying an uploaded file reference and pasting it into the
   * ticket comment composer.
   */
  const handleCopyArtifactMarkdown = useCallback(
    async (artifact: ITicketArtifact) => {
      try {
        await navigator.clipboard.writeText(getArtifactMarkdown(artifact));
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Copied artifact markdown'
        });
      } catch {
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Failed to copy artifact markdown.'
        });
      }
    },
    [dialogContext, getArtifactMarkdown]
  );

  /**
   * Uploads artifacts selected from the hidden file input triggered by the PageSection Upload button.
   *
   * Validates the configured file count and per-file size limits, uploads each accepted file to its presigned URL, then
   * completes the ticket upload and refreshes both the artifacts grid and ticket detail cache.
   */
  const handleUploadSelection = async (artifacts: File[]) => {
    try {
      setIsUploading(true);
      let didUpload = false;

      for (const artifact of artifacts) {
        if (artifact.size > config.MAX_TICKET_ATTACHMENT_FILE_SIZE) {
          const maxTicketAttachmentFileSizeMB = Math.round(config.MAX_TICKET_ATTACHMENT_FILE_SIZE / 1024 / 1024);

          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: `Attachment exceeds the ${maxTicketAttachmentFileSizeMB} MB limit.`
          });
          continue;
        }

        const initializedUpload = await api.tickets.createTicketUpload(ticket.ticket_id, {
          file_name: artifact.name,
          byte_size: artifact.size,
          content_type: artifact.type || 'application/octet-stream'
        });

        const uploadResponse = await axios.put(initializedUpload.presigned_upload_url, artifact, {
          headers: {
            'Content-Type': artifact.type || 'application/octet-stream'
          }
        });

        if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
          throw new Error('Failed to upload attachment.');
        }

        await api.tickets.completeTicketUpload(ticket.ticket_id, initializedUpload.upload_id, {
          status: 'uploaded'
        });
        didUpload = true;
      }

      if (didUpload) {
        await ticketArtifactsGrid.refresh();
        await ticketDataLoader.refresh(ticket.ticket_id);
      }
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message || 'Failed to upload attachment.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <PageSection
      id="ticket-artifacts"
      label="Files"
      headerContent={
        <TicketCommentArtifactUpload
          label="Upload"
          buttonAriaLabel="Upload"
          inputAriaLabel="Upload ticket artifact input"
          iconPath={mdiPlus}
          iconSize={0.8}
          isUploading={isUploading}
          buttonProps={{ color: 'primary', size: 'small', variant: 'contained' }}
          onArtifactsSelected={handleUploadSelection}
        />
      }>
      <TicketArtifactsTable
        rows={ticketArtifactsGrid.rows}
        rowCount={ticketArtifactsGrid.rowCount}
        paginationModel={ticketArtifactsGrid.paginationModel}
        setPaginationModel={ticketArtifactsGrid.handlePaginationChange}
        sortModel={ticketArtifactsGrid.sortModel}
        setSortModel={ticketArtifactsGrid.handleSortChange}
        isLoading={ticketArtifactsGrid.isLoading || isUploading}
        onDownload={handleDownloadArtifact}
        onCopy={handleCopyArtifactMarkdown}
      />
    </PageSection>
  );
};
