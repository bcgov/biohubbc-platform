import Container from '@mui/material/Container';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
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
  const downloadLoader = useDataLoader((id: string) => api.download.getDownload(id));
  const versionLoader = useDataLoader((parentDownloadId: string, versionId: string) =>
    api.download.getDownloadVersion(parentDownloadId, versionId)
  );

  useEffect(() => {
    if (downloadId && downloadVersionId) {
      downloadLoader.load(downloadId);
      versionLoader.load(downloadId, downloadVersionId);
    }
  }, [downloadId, downloadVersionId, downloadLoader, versionLoader]);

  const download = downloadLoader.data;
  const version = versionLoader.data;
  const apiError = (downloadLoader.error ?? versionLoader.error) as APIError | undefined;

  if (apiError?.status === 404 || apiError?.status === 403) {
    return <DownloadDeadEndCard />;
  }

  return (
    <LoadingGuard
      isLoading={(downloadLoader.isLoading || versionLoader.isLoading) && (!download || !version)}
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
