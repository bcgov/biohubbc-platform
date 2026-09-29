import Container from '@mui/material/Container';
import { skipToken, useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useParams } from 'react-router';
import { downloadQueryKeys } from 'utils/query-keys/download-query-keys';
import { DownloadDeadEndCard } from './components/DownloadDeadEndCard';
import { DownloadPageHeader } from './components/header/DownloadPageHeader';
import { DownloadVersionsTable } from './components/table/DownloadVersionsTable';

/**
 * Download page with the download's version table.
 *
 * @return {JSX.Element} The download page, loading state, or unavailable state.
 */
export const DownloadPage = () => {
  const { downloadId } = useParams<{ downloadId: string }>();
  const api = useApi();
  const downloadQuery = useQuery({
    queryKey: downloadQueryKeys.detail(downloadId ?? ''),
    queryFn: downloadId ? ({ signal }) => api.download.getDownload(downloadId, { signal }) : skipToken
  });

  const download = downloadQuery.data;
  const apiError = downloadQuery.error as APIError | null;

  if (apiError?.status === 404 || apiError?.status === 403) {
    return <DownloadDeadEndCard />;
  }

  return (
    <LoadingGuard isLoading={downloadQuery.isFetching && !download} isLoadingFallback={<SkeletonPage />}>
      {download ? (
        <>
          <DownloadPageHeader download={download} />
          <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
            <DownloadVersionsTable downloadId={download.download_id} />
          </Container>
        </>
      ) : null}
    </LoadingGuard>
  );
};
