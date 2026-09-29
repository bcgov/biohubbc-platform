import Container from '@mui/material/Container';
import { skipToken, useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useState } from 'react';
import { useParams } from 'react-router';
import { downloadQueryKeys } from 'utils/query-keys/download-query-keys';
import { DownloadDeadEndCard } from './components/DownloadDeadEndCard';
import { DownloadVersionFeaturesSection } from './components/DownloadVersionFeaturesSection';
import { DownloadVersionPageHeader } from './components/header/DownloadVersionPageHeader';
import { DownloadVersionExportTable } from './components/table/DownloadVersionExportTable';

type DownloadVersionTab = 'features' | 'exports';

/**
 * Detail page for one materialized version of a download.
 *
 * @return {JSX.Element} The version detail page, loading state, or unavailable state.
 */
export const DownloadVersionPage = () => {
  const { downloadId, downloadVersionId } = useParams<{ downloadId: string; downloadVersionId: string }>();
  const api = useApi();
  const [activeTab, setActiveTab] = useState<DownloadVersionTab>('features');
  const downloadQuery = useQuery({
    queryKey: downloadQueryKeys.detail(downloadId ?? ''),
    queryFn:
      downloadId && downloadVersionId ? ({ signal }) => api.download.getDownload(downloadId, { signal }) : skipToken
  });
  const versionQuery = useQuery({
    queryKey: downloadQueryKeys.version(downloadId ?? '', downloadVersionId ?? ''),
    queryFn:
      downloadId && downloadVersionId
        ? ({ signal }) => api.download.getDownloadVersion(downloadId, downloadVersionId, { signal })
        : skipToken
  });

  const download = downloadQuery.data;
  const version = versionQuery.data;
  const apiError = (downloadQuery.error ?? versionQuery.error) as APIError | null;

  if (apiError?.status === 404 || apiError?.status === 403) {
    return <DownloadDeadEndCard />;
  }

  return (
    <LoadingGuard
      isLoading={(downloadQuery.isFetching || versionQuery.isFetching) && (!download || !version)}
      isLoadingFallback={<SkeletonPage />}>
      {download && version ? (
        <>
          <DownloadVersionPageHeader
            download={download}
            version={version}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
            <ComponentSwitch<DownloadVersionTab>
              switch={activeTab}
              components={{
                features: <DownloadVersionFeaturesSection />,
                exports: (
                  <DownloadVersionExportTable
                    downloadId={download.download_id}
                    downloadVersionId={version.download_version_id}
                  />
                )
              }}
            />
          </Container>
        </>
      ) : null}
    </LoadingGuard>
  );
};
