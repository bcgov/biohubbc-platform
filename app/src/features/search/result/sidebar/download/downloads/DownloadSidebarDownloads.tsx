import { mdiRefresh } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, List, ListItem, Pagination, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { DownloadFeatureCard } from '../feature/DownloadFeatureCard';

const PAGE_SIZE = 10;

export const DownloadSidebarDownloads = () => {
  const biohubApi = useApi();
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
              <DownloadFeatureCard download={download} />
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
