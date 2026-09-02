import Container from '@mui/material/Container';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
import { useParams } from 'react-router';
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
  const downloadLoader = useDataLoader((id: string) => api.download.getDownload(id));

  useEffect(() => {
    if (downloadId) {
      downloadLoader.load(downloadId);
    }
  }, [downloadId, downloadLoader]);

  const download = downloadLoader.data;
  const apiError = downloadLoader.error as APIError | undefined;

  if (apiError?.status === 404 || apiError?.status === 403) {
    return <DownloadDeadEndCard />;
  }

  return (
    <LoadingGuard isLoading={downloadLoader.isLoading && !download} isLoadingFallback={<SkeletonPage />}>
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
