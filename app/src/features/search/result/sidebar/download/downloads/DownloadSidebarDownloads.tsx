import { mdiRefresh } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, List, ListItem, Pagination, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { type DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { DownloadFeatureCard } from '../feature/DownloadFeatureCard';

const PAGE_SIZE = 10;

/**
 * Predicate for "this export is ready for download". No `'downloaded'` branch because
 * `download_export.status` doesn't transition to `'downloaded'` — that's a `download`-only
 * terminal. Exported (not inlined) so the card can share the same definition via sibling
 * import.
 */
export const isExportReady = (status: DownloadExportStatus): boolean => status === 'ready';

/**
 * Inject a hidden iframe that triggers a browser download of the given URL, then clean it up
 * after 30 seconds.
 *
 * Why iframe over `window.open`: popup blockers reject rapid-fire `window.open` calls (multi-
 * part downloads hit this), and browsers collapse concurrent tabs. The iframe technique
 * works around both problems and avoids stealing focus.
 */
export const triggerIframeDownload = (url: string): void => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
  }, 30000);
};

/**
 * Sidebar list of the current user's downloads, with per-download Export menu + Exports rows
 * delegated to `DownloadFeatureCard`.
 *
 * No polling on exports — the sidebar refresh button and the post-`handleCreateExport` refresh
 * are the only signals. Each refresh replays the backend's pre-join (`download.exports`), so
 * new export rows surface without a dedicated cache primitive.
 *
 * This component owns `useApi`, `useDialogContext().setErrorDialog`, and the iframe-injection
 * technique. The card stays presentational; all four handlers below live here.
 */
export const DownloadSidebarDownloads = () => {
  const biohubApi = useApi();
  const dialogContext = useDialogContext();
  const [page, setPage] = useState(1);

  const downloadsDataLoader = useDataLoader((pagination: ApiPaginationRequestOptions) =>
    biohubApi.download.getDownloads(pagination)
  );

  useEffect(() => {
    downloadsDataLoader.refresh({ page, limit: PAGE_SIZE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const downloads = downloadsDataLoader.data?.downloads ?? [];
  const lastPage = downloadsDataLoader.data?.pagination?.last_page ?? 1;

  /**
   * Create a new CSV export for a ready download, then refresh the list. The refresh replays
   * the backend's pre-join (`download.exports`) — the new pending export row surfaces via that
   * refresh, so we need no separate cache or version bumper.
   * Failures open the standard export error dialog.
   *
   * @param {string} downloadId - Download request id to export.
   * @param {string} downloadVersionId - Active version of the download the export is built from.
   */
  const handleCreateExport = async (downloadId: string, downloadVersionId: string) => {
    try {
      await biohubApi.downloadExport.createExport(downloadId, { download_version_id: downloadVersionId });
      await downloadsDataLoader.refresh({ page, limit: PAGE_SIZE });
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Export Error',
        dialogText: 'Failed to start the export.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Downloads a single export part by resolving a fresh presigned URL first.
   * A missing part uses the same "Download Error" dialog as API failures.
   *
   * @param {string} downloadId - Download id that owns the export.
   * @param {string} exportId - Export id containing the requested part.
   * @param {number} chunkId - One-based part id to download.
   */
  const handleDownloadExportPart = async (downloadId: string, exportId: string, chunkId: number) => {
    try {
      const detail = await biohubApi.downloadExport.getExport(downloadId, exportId);
      const part = detail.parts.find((p) => p.chunk_id === chunkId);
      if (!part) {
        throw new Error('Part not found');
      }
      triggerIframeDownload(part.url);
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Download Error',
        dialogText: 'Failed to retrieve the export part.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Downloads every part for a ready multi-part export.
   * Fetches export detail once, then iframe-injects each part URL in backend
   * order. No iframe downloads start if detail fetch fails.
   *
   * @param {string} downloadId - Download id that owns the export.
   * @param {string} exportId - Export id whose parts should all be downloaded.
   */
  const handleDownloadExportAllParts = async (downloadId: string, exportId: string) => {
    try {
      const detail = await biohubApi.downloadExport.getExport(downloadId, exportId);
      for (const part of detail.parts) {
        triggerIframeDownload(part.url);
      }
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Download Error',
        dialogText: 'Failed to retrieve the export.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Handles the rebuild affordance for ready exports with no available parts.
   * Currently shows an explanatory dialog; the rebuild API is not wired yet.
   *
   * @param {string} _exportId - Export id reserved for the future rebuild request.
   */
  const handleRebuildExport = async (_exportId: string) => {
    dialogContext.setErrorDialog({
      open: true,
      dialogTitle: 'Nothing to download',
      dialogText:
        'This export produced no files (no rows matched the download filter). Start a new download to rebuild.',
      onOk: () => dialogContext.setErrorDialog({ open: false }),
      onClose: () => dialogContext.setErrorDialog({ open: false })
    });
  };

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" px={1}>
        <IconButton
          size="small"
          title="Refresh downloads"
          onClick={() => downloadsDataLoader.refresh({ page, limit: PAGE_SIZE })}
          disabled={downloadsDataLoader.isLoading}>
          <Icon path={mdiRefresh} size={0.8} />
        </IconButton>
      </Stack>
      <LoadingGuard
        isLoading={downloadsDataLoader.isLoading}
        isLoadingFallback={<SkeletonList numberOfLines={5} />}
        hasNoData={!downloadsDataLoader.isLoading && downloads.length === 0}
        hasNoDataFallback={
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No downloads
          </Typography>
        }>
        <List dense disablePadding>
          {downloads.map((download) => (
            <ListItem key={download.download_id} disableGutters sx={{ width: 1, pb: 1 }}>
              <DownloadFeatureCard
                download={download}
                exports={download.exports}
                onCreateExport={() => handleCreateExport(download.download_id, download.download_version_id)}
                onDownloadExportPart={(exportId, chunkId) =>
                  handleDownloadExportPart(download.download_id, exportId, chunkId)
                }
                onDownloadExportAllParts={(exportId) => handleDownloadExportAllParts(download.download_id, exportId)}
                onRebuildExport={handleRebuildExport}
              />
            </ListItem>
          ))}
        </List>
        {lastPage > 1 ? (
          <Stack alignItems="center" py={1}>
            <Pagination count={lastPage} page={page} onChange={(_, newPage) => setPage(newPage)} size="small" />
          </Stack>
        ) : null}
      </LoadingGuard>
    </>
  );
};
