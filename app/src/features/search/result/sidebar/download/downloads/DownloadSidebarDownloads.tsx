import { IconButton, List, ListItem, Stack, Typography } from '@mui/material';
import Icon from '@mdi/react';
import { mdiRefresh } from '@mdi/js';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useDialogContext } from 'hooks/useContext';
import { DownloadFeatureCard } from '../feature/DownloadFeatureCard';

/**
 * Whether a download is in a state where its zip package can be retrieved.
 * Only `ready` and `downloaded` statuses have completed artifacts in S3 (AC #2).
 * `pending` and `processing` are still building; `failed` has no artifact.
 */
export const isDownloadReady = (status: string): boolean => status === 'ready' || status === 'downloaded';

export const DownloadSidebarDownloads = () => {
  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  const downloadsDataLoader = useDataLoader(() => biohubApi.download.getDownloads());
  downloadsDataLoader.load();

  const handleDownloadFragment = async (downloadId: string, fragmentIndex: number) => {
    try {
      const { url } = await biohubApi.download.getFragmentUrl(downloadId, fragmentIndex);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Download Error',
        dialogText: 'Failed to retrieve the download URL.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Download all fragments sequentially with a short delay between each.
   * Each fragment opens in a new tab — browsers may prompt to allow multiple downloads
   * on the first attempt (Chrome remembers the permission per domain).
   */
  const handleDownloadAll = async (downloadId: string, totalFragments: number) => {
    for (let i = 0; i < totalFragments; i++) {
      try {
        const { url } = await biohubApi.download.getFragmentUrl(downloadId, i);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        dialogContext.setErrorDialog({
          open: true,
          dialogTitle: 'Download Error',
          dialogText: `Failed to retrieve URL for part ${i + 1}.`,
          onOk: () => dialogContext.setErrorDialog({ open: false }),
          onClose: () => dialogContext.setErrorDialog({ open: false })
        });
        return;
      }
    }
  };

  const downloads = downloadsDataLoader.data?.downloads ?? [];

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" px={1}>
        <IconButton
          size="small"
          title="Refresh downloads"
          onClick={() => downloadsDataLoader.refresh()}
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
              <DownloadFeatureCard download={download} onDownloadFragment={handleDownloadFragment} onDownloadAll={handleDownloadAll} />
            </ListItem>
          ))}
        </List>
      </LoadingGuard>
    </>
  );
};
