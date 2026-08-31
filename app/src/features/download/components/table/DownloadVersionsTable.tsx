import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { DOWNLOAD_TABLE_STATUS_CHIP_COLORS } from 'constants/download';
import dayjs from 'dayjs';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { DownloadStatus, DownloadVersion } from 'interfaces/useDownloadApi.interface';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
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
            ({versions.rowCount})
          </Typography>
        </>
      }>
      <ServerPaginatedDataGrid<DownloadVersion>
        dataTestId="download-versions-table"
        rows={versions.rows}
        columns={columns}
        getRowId={(row) => row.download_version_id}
        noRowsMessage="No versions"
        rowCount={versions.rowCount}
        paginationModel={versions.paginationModel}
        setPaginationModel={versions.handlePaginationChange}
        sortModel={versions.sortModel}
        setSortModel={versions.handleSortChange}
        onRowClick={(version) => navigate(`/download/${downloadId}/version/${version.download_version_id}`)}
      />
    </PageSection>
  );
};
