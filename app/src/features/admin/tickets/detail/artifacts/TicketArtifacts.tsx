import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Stack from '@mui/material/Stack';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import SearchTextField from 'components/fields/SearchTextField';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { useCallback } from 'react';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { useTicketAttachmentUpload } from '../../hooks/useTicketAttachmentUpload';
import { downloadTicketArtifact } from '../../utils/ticketArtifactDownload';
import { getTicketArtifactMarkdown } from '../../utils/ticketArtifactMarkdown';
import { TicketArtifactUpload } from '../TicketArtifactUpload';
import { TicketArtifactsTable } from './table/TicketArtifactsTable';

/**
 * Artifacts panel for ticket attachments.
 *
 * @return {*}
 */
export const TicketArtifacts = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId } = useTicketContext();
  const { isUploadingAttachment, uploadTicketAttachment } = useTicketAttachmentUpload();
  const queryClient = useQueryClient();
  const artifactsGrid = useServerPaginatedGridState({ defaultSort: { field: 'create_date', sort: 'desc' } });
  const artifactsParams = { search: artifactsGrid.debouncedSearchTerm, ...artifactsGrid.apiPagination };
  const artifactsQuery = useQuery({
    queryKey: ticketQueryKeys.artifacts(ticketId, artifactsParams),
    queryFn: ({ signal }) => api.tickets.getTicketArtifacts(ticketId, artifactsParams, { signal }),
    placeholderData: keepPreviousData
  });

  /**
   * Opens a ticket artifact in a new tab using a short-lived signed download URL.
   *
   * Used by the row download action. The blank tab is opened before the async API call so browsers do not block it as an
   * unsolicited pop-up, then redirected once the signed URL is available.
   */
  const handleDownloadArtifact = useCallback(
    (artifact: ITicketArtifact) =>
      downloadTicketArtifact({
        ticketId,
        artifact,
        getDownloadUrl: api.tickets.getTicketArtifactDownloadUrl,
        setSnackbar: dialogContext.setSnackbar
      }),
    [api.tickets, dialogContext, ticketId]
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
        await navigator.clipboard.writeText(getTicketArtifactMarkdown(artifact));
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
    [dialogContext]
  );

  /**
   * Uploads artifacts selected from the hidden file input triggered by the PageSection Upload button.
   *
   * Delegates each selected file to the shared ticket attachment uploader, then refreshes the paginated artifacts grid
   * when at least one upload succeeds.
   */
  const handleUploadSelection = async (artifacts: File[]) => {
    let didUpload = false;

    for (const artifact of artifacts) {
      const ticketArtifact = await uploadTicketAttachment(artifact);

      if (ticketArtifact) {
        didUpload = true;
      }
    }

    if (didUpload) {
      void queryClient.invalidateQueries({ queryKey: ticketQueryKeys.artifactsAll(ticketId) });
    }
  };

  return (
    <PageSection
      id="ticket-artifacts"
      label="Files"
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <SearchTextField
            size="small"
            placeholder="Search files"
            value={artifactsGrid.searchTerm}
            onChange={(event) => artifactsGrid.handleSearch(event.target.value)}
          />
          <TicketArtifactUpload
            label="Upload"
            isUploading={isUploadingAttachment}
            onArtifactsSelected={handleUploadSelection}
            size="small"
            startIcon={<Icon path={mdiPlus} size={0.8} />}
            variant="text"
          />
        </Stack>
      }>
      <TicketArtifactsTable
        rows={artifactsQuery.data?.artifacts ?? []}
        rowCount={artifactsQuery.data?.pagination.total ?? 0}
        paginationModel={artifactsGrid.paginationModel}
        setPaginationModel={artifactsGrid.handlePaginationChange}
        sortModel={artifactsGrid.sortModel}
        setSortModel={artifactsGrid.handleSortChange}
        isLoading={artifactsQuery.isFetching || isUploadingAttachment}
        onDownload={handleDownloadArtifact}
        onCopy={handleCopyArtifactMarkdown}
      />
    </PageSection>
  );
};
