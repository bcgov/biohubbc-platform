import { mdiRefresh } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, List, ListItem, Pagination, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { DownloadFeatureCard } from '../feature/DownloadFeatureCard';

const PAGE_SIZE = 10;

/**
 * Predicate for "this export is ready for download". No `'downloaded'` branch because
 * `download_export.status` doesn't transition to `'downloaded'` — that's a `download`-only
 * terminal. Exported (not inlined) so the card can share the same definition via sibling
 * import.
 */
export const isExportReady = (status: string): boolean => status === 'ready';

/**
 * Inject a hidden iframe that triggers a browser download of the given URL, then clean it up
 * after 30 seconds.
 *
 * Why iframe over `window.open`: popup blockers reject rapid-fire `window.open` calls (multi-
 * part downloads hit this), and browsers collapse concurrent tabs. The iframe technique was
 * inherited from the legacy `DownloadFeatureCard`'s `handleDownloadFragment` — it works around
 * both problems and avoids stealing focus. The 30s cleanup timeout matches the legacy interval.
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
   */
  const handleCreateExport = async (downloadId: string) => {
    try {
      await biohubApi.downloadExport.createExport(downloadId);
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
   * Fetch the export detail, find the matching part-zip, and iframe-inject its presigned URL.
   * A missing part (should never happen — `part_count` is the source of truth) surfaces the
   * same "Download Error" dialog as any other failure.
   */
  const handleDownloadExportPart = async (exportId: string, chunkId: number) => {
    try {
      const detail = await biohubApi.downloadExport.getExport(exportId);
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
   * Download every part of a ready export. Makes ONE `getExport` call — the detail response
   * carries all part URLs — then iframe-injects each in order. N parts does not mean N round-
   * trips.
   */
  const handleDownloadExportAllParts = async (exportId: string) => {
    try {
      const detail = await biohubApi.downloadExport.getExport(exportId);
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
   * Stub rebuild handler — today's zero-row-edge-case surface AND tomorrow's S3-TTL-rebuild
   * surface.
   *
   * Today: tells the user there's nothing to download (no rows matched the download filter).
   * Future (S3 TTL ticket): body swaps to
   *   `await biohubApi.downloadExport.rebuildExport(exportId);`
   *   `await downloadsDataLoader.refresh({ page, limit: PAGE_SIZE });`
   * and the row transitions back through `pending → processing → ready` with fresh part-zips.
   * The card's rebuild branch does not change — only this handler grows.
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
                onCreateExport={handleCreateExport}
                onDownloadExportPart={handleDownloadExportPart}
                onDownloadExportAllParts={handleDownloadExportAllParts}
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
