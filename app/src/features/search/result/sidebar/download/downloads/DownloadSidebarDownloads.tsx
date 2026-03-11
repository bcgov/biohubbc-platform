import { IconButton, List, ListItem, Pagination, Stack, Typography } from '@mui/material';
import Icon from '@mdi/react';
import { mdiRefresh } from '@mdi/js';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useDialogContext } from 'hooks/useContext';
import { useEffect, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { DownloadFeatureCard } from '../feature/DownloadFeatureCard';

/**
 * Whether a download is in a state where its zip package can be retrieved.
 * Only `ready` and `downloaded` statuses have completed artifacts in S3 (AC #2).
 * `pending` and `processing` are still building; `failed` has no artifact.
 */
export const isDownloadReady = (status: string): boolean => status === 'ready' || status === 'downloaded';

const PAGE_SIZE = 10;

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

  const handleDownloadFragment = async (downloadId: string, fragmentIndex: number) => {
    try {
      const { url } = await biohubApi.download.getFragmentUrl(downloadId, fragmentIndex);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => document.body.removeChild(iframe), 30000);
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
   * Download all fragments using iframes to avoid popup blockers and browser
   * collapsing rapid <a> clicks into a single download. Each iframe independently
   * triggers a Content-Disposition: attachment response from S3.
   */
  const handleDownloadAll = async (downloadId: string, totalFragments: number) => {
    try {
      for (let i = 0; i < totalFragments; i++) {
        const { url } = await biohubApi.download.getFragmentUrl(downloadId, i);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        // Clean up after download starts
        setTimeout(() => document.body.removeChild(iframe), 30000);
      }
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Download Error',
        dialogText: 'Failed to retrieve download URLs.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  const downloads = downloadsDataLoader.data?.downloads ?? [];
  const lastPage = downloadsDataLoader.data?.pagination?.last_page ?? 1;

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
                onDownloadFragment={handleDownloadFragment}
                onDownloadAll={handleDownloadAll}
              />
            </ListItem>
          ))}
        </List>
        {lastPage > 1 && (
          <Stack alignItems="center" py={1}>
            <Pagination count={lastPage} page={page} onChange={(_, newPage) => setPage(newPage)} size="small" />
          </Stack>
        )}
      </LoadingGuard>
    </>
  );
};
