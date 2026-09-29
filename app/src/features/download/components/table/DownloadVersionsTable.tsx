import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { DOWNLOAD_TABLE_STATUS_CHIP_COLORS } from 'constants/download';
import dayjs from 'dayjs';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { DownloadStatus, DownloadVersion } from 'interfaces/useDownloadApi.interface';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { downloadQueryKeys } from 'utils/query-keys/download-query-keys';
import { DownloadVersionExportButton } from '../DownloadVersionExportButton';

interface DownloadVersionsTableProps {
  downloadId: string;
}

/**
 * Renders the paginated version collection and its per-version export actions.
 *
 * @param {DownloadVersionsTableProps} props - Parent download used to load and navigate versions.
 * @return {JSX.Element} The paginated download versions table.
 */
export const DownloadVersionsTable = ({ downloadId }: DownloadVersionsTableProps) => {
  const api = useApi();
  const navigate = useNavigate();
  const versionsGrid = useServerPaginatedGridState({ defaultSort: { field: 'create_date', sort: 'desc' } });
  const versionsPagination = {
    ...versionsGrid.apiPagination,
    sort: versionsGrid.apiPagination.sort ?? 'create_date',
    order: versionsGrid.apiPagination.order ?? 'desc'
  };
  const versionsQuery = useQuery({
    queryKey: downloadQueryKeys.versions(downloadId, versionsPagination),
    queryFn: ({ signal }) => api.download.listDownloadVersions(downloadId, versionsPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const columns = useMemo<GridColDef<DownloadVersion>[]>(
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
        renderCell: (params) => (
          <Chip
            label={params.value}
            size="small"
            color={DOWNLOAD_TABLE_STATUS_CHIP_COLORS[params.value as DownloadStatus]}
            sx={{ fontWeight: 700, textTransform: 'capitalize' }}
          />
        )
      },
      {
        field: 'create_date',
        headerName: 'Created at',
        minWidth: 180,
        flex: 0.8,
        valueGetter: (_value, row) => dayjs(row.create_date).format(DATE_FORMAT.MediumDateFormat)
      },
      {
        field: 'actions',
        headerName: '',
        minWidth: 120,
        flex: 0.5,
        sortable: false,
        renderCell: ({ row }) => (
          <DownloadVersionExportButton
            downloadId={downloadId}
            downloadVersionId={row.download_version_id}
            status={row.status}
          />
        )
      }
    ],
    [downloadId]
  );

  return (
    <PageSection
      id="download-versions"
      label={
        <>
          Versions{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({versionsQuery.data?.pagination.total ?? 0})
          </Typography>
        </>
      }>
      <ServerPaginatedDataGrid<DownloadVersion>
        dataTestId="download-versions-table"
        rows={versionsQuery.data?.versions ?? []}
        columns={columns}
        getRowId={(row) => row.download_version_id}
        noRowsMessage="No versions"
        rowCount={versionsQuery.data?.pagination.total ?? 0}
        paginationModel={versionsGrid.paginationModel}
        setPaginationModel={versionsGrid.handlePaginationChange}
        sortModel={versionsGrid.sortModel}
        setSortModel={versionsGrid.handleSortChange}
        onRowClick={(version) => navigate(`/download/${downloadId}/version/${version.download_version_id}`)}
      />
    </PageSection>
  );
};
