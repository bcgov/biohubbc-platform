import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
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

interface DownloadVersionPageProps {
  /** Base route the page is served under, either the open or the Portal download route. */
  basePath: string;
}

/**
 * Detail page for one materialized version of a download.
 *
 * @param {DownloadVersionPageProps} props - Base route used for the page's links and breadcrumbs.
 * @return {JSX.Element} The version detail page, loading state, or unavailable state.
 */
export const DownloadVersionPage = ({ basePath }: DownloadVersionPageProps) => {
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
    <>
      <QueryErrorDialog error={downloadQuery.error} label="download" />
      <QueryErrorDialog error={versionQuery.error} label="download version" />
      <LoadingGuard
        isLoading={(downloadQuery.isFetching || versionQuery.isFetching) && (!download || !version)}
        isLoadingFallback={<SkeletonPage maxWidth="lg" />}>
        {download && version ? (
          <>
            <DownloadVersionPageHeader
              download={download}
              version={version}
              basePath={basePath}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <Container maxWidth="lg" sx={{ py: 4, px: 3 }}>
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
    </>
  );
};
