import { mdiHelpCircleOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { GridColDef, GridValidRowModel } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { PageSection } from 'components/section/PageSection';
import { DOWNLOAD_TABLE_STATUS_CHIP_COLORS } from 'constants/download';
import { APIError } from 'hooks/api/useAxios';
import useDataLoader from 'hooks/useDataLoader';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { DownloadStatus, DownloadVersion } from 'interfaces/useDownloadApi.interface';
import { DownloadExport, DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { getRelativeTimeLabel } from 'utils/date';

type DownloadPageTab = 'versions' | 'exports';

/**
 * Download page with version and export tables.
 */
export const DownloadPage = () => {
  const { downloadId } = useParams<{ downloadId: string }>();
  const api = useApi();
  const [activeTab, setActiveTab] = useState<DownloadPageTab>('versions');

  const downloadDataLoader = useDataLoader((id: string) => api.download.getDownload(id));

  useEffect(() => {
    if (downloadId) {
      downloadDataLoader.load(downloadId);
    }
  }, [downloadId, downloadDataLoader]);

  const download = downloadDataLoader.data;
  const apiError = downloadDataLoader.error as APIError | undefined;
  const isDeadEnd = apiError?.status === 404 || apiError?.status === 403;

  if (isDeadEnd) {
    return <DeadEndCard />;
  }

  return (
    <LoadingGuard isLoading={downloadDataLoader.isLoading && !download} isLoadingFallback={<SkeletonPage />}>
      {download ? (
        <>
          <PageHeader
            breadcrumbs={
              <Breadcrumbs aria-label="download breadcrumb">
                <Link component={RouterLink} to="/search" underline="hover" color="inherit">
                  Search
                </Link>
                <Link component={RouterLink} to="/portal/downloads" underline="hover" color="inherit">
                  Downloads
                </Link>
                <Link component={RouterLink} to={`/download/${download.download_id}`} underline="hover" color="inherit">
                  {download.name}
                </Link>
              </Breadcrumbs>
            }
            label="Download"
            subheader={download.name}
            description={download.description}
            tabs={
              <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} aria-label="download tabs">
                <Tab value="versions" label="Versions" id="download-versions-tab" aria-controls="download-versions" />
                <Tab value="exports" label="Exports" id="download-exports-tab" aria-controls="download-exports" />
              </Tabs>
            }
          />

          <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
            {activeTab === 'versions' ? (
              <DownloadVersionsSection downloadId={download.download_id} />
            ) : (
              <DownloadExportsSection downloadId={download.download_id} />
            )}
          </Container>
        </>
      ) : null}
    </LoadingGuard>
  );
};

const DownloadVersionsSection = ({ downloadId }: { downloadId: string }) => {
  const api = useApi();
  const versions = useServerPaginatedDataGrid({
    fetcher: (_search, pagination) =>
      api.download.listDownloadVersions(downloadId, {
        ...pagination,
        sort: pagination.sort ?? 'create_date',
        order: pagination.order ?? 'desc'
      }),
    extractData: (response) => response.versions,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'create_date', sort: 'desc' }
  });
  const versionColumns = useVersionColumns();

  return (
    <PageSection id="download-versions" label={<SectionLabel label="Versions" count={versions.rowCount} />}>
      <ServerPaginatedDataGrid<DownloadVersion>
        dataTestId="download-versions-table"
        rows={versions.rows}
        columns={versionColumns}
        getRowId={(row) => row.download_version_id}
        noRowsMessage="No versions"
        rowCount={versions.rowCount}
        paginationModel={versions.paginationModel}
        setPaginationModel={versions.handlePaginationChange}
        sortModel={versions.sortModel}
        setSortModel={versions.handleSortChange}
      />
    </PageSection>
  );
};

const DownloadExportsSection = ({ downloadId }: { downloadId: string }) => {
  const api = useApi();
  const exports = useServerPaginatedDataGrid({
    fetcher: (_search, pagination) =>
      api.downloadExport.getExports(downloadId, {
        ...pagination,
        sort: pagination.sort ?? 'started_at',
        order: pagination.order ?? 'desc'
      }),
    extractData: (response) => response.exports,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'started_at', sort: 'desc' }
  });
  const exportColumns = useExportColumns();

  return (
    <PageSection id="download-exports" label={<SectionLabel label="Exports" count={exports.rowCount} />}>
      <ServerPaginatedDataGrid<DownloadExport>
        dataTestId="download-exports-table"
        rows={exports.rows}
        columns={exportColumns}
        getRowId={(row) => row.download_version_export_id}
        noRowsMessage="No exports"
        rowCount={exports.rowCount}
        paginationModel={exports.paginationModel}
        setPaginationModel={exports.handlePaginationChange}
        sortModel={exports.sortModel}
        setSortModel={exports.handleSortChange}
      />
    </PageSection>
  );
};

const useVersionColumns = (): GridColDef<DownloadVersion>[] =>
  useMemo(
    () => [
      {
        field: 'download_version_id',
        headerName: 'Version ID',
        minWidth: 260,
        flex: 1.4,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {params.value}
          </Typography>
        )
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 130,
        flex: 0.7,
        renderCell: (params) => <StatusChip status={params.value} />
      },
      {
        field: 'feature_count',
        headerName: 'Feature count',
        minWidth: 140,
        flex: 0.7,
        renderCell: (params) => <Typography variant="body2">{params.value ?? '-'}</Typography>
      },
      dateColumn('started_at', 'Started'),
      dateColumn('completed_at', 'Completed'),
      dateColumn('materialized_at', 'Materialized'),
      errorColumn<DownloadVersion>()
    ],
    []
  );

const useExportColumns = (): GridColDef<DownloadExport>[] =>
  useMemo(
    () => [
      {
        field: 'download_version_export_id',
        headerName: 'Export ID',
        minWidth: 260,
        flex: 1.4,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {params.value}
          </Typography>
        )
      },
      {
        field: 'format',
        headerName: 'Format',
        minWidth: 100,
        flex: 0.5,
        renderCell: (params) => <Typography variant="body2">{params.value}</Typography>
      },
      {
        field: 'mode',
        headerName: 'Mode',
        minWidth: 170,
        flex: 0.9,
        renderCell: (params) => <Typography variant="body2">{formatMode(params.value)}</Typography>
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 130,
        flex: 0.7,
        renderCell: (params) => <StatusChip status={params.value} />
      },
      {
        field: 'part_count',
        headerName: 'Parts',
        minWidth: 100,
        flex: 0.5,
        renderCell: (params) => <Typography variant="body2">{params.value}</Typography>
      },
      dateColumn('started_at', 'Started'),
      dateColumn('completed_at', 'Completed'),
      errorColumn<DownloadExport>()
    ],
    []
  );

const SectionLabel = ({ label, count }: { label: string; count: number }) => (
  <>
    {label}{' '}
    <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
      ({count})
    </Typography>
  </>
);

const StatusChip = ({ status }: { status: DownloadStatus | DownloadExportStatus }) => (
  <Chip
    label={status}
    size="small"
    color={DOWNLOAD_TABLE_STATUS_CHIP_COLORS[status]}
    sx={{ fontWeight: 700, textTransform: 'capitalize' }}
  />
);

const dateColumn = <TRow extends GridValidRowModel>(field: string, headerName: string): GridColDef<TRow> => ({
  field,
  headerName,
  minWidth: 150,
  flex: 0.8,
  renderCell: (params) => (
    <Typography variant="body2" noWrap title={params.value || ''}>
      {getRelativeTimeLabel(typeof params.value === 'string' ? params.value : undefined) ?? '-'}
    </Typography>
  )
});

const errorColumn = <TRow extends GridValidRowModel>(): GridColDef<TRow> => ({
  field: 'error_message',
  headerName: 'Error',
  minWidth: 180,
  flex: 1,
  sortable: false,
  renderCell: (params) => (
    <Typography variant="body2" noWrap title={params.value || ''}>
      {params.value || '-'}
    </Typography>
  )
});

const formatMode = (mode: string) => mode.replaceAll('_', ' ');

const DeadEndCard = () => (
  <Container maxWidth="sm">
    <Box pt={6} textAlign="center">
      <Icon path={mdiHelpCircleOutline} size={2} color="#ff5252" />
      <h1>Download not available</h1>
      <Typography>This download link is invalid or no longer accessible.</Typography>
    </Box>
  </Container>
);
