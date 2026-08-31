import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DOWNLOAD_TABLE_STATUS_CHIP_COLORS } from 'constants/download';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { DownloadExport, DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';
import { useMemo } from 'react';
import { getRelativeTimeLabel } from 'utils/date';
import { DownloadVersionExportDownloadButton } from '../DownloadVersionExportDownloadButton';

interface DownloadVersionExportTableProps {
  downloadId: string;
  downloadVersionId: string;
}

/**
 * Renders the paginated exports belonging to one download version.
 *
 * @param {DownloadVersionExportTableProps} props - Parent download and selected version identifiers.
 * @return {JSX.Element} The paginated version exports table.
 */
export const DownloadVersionExportTable = ({ downloadId, downloadVersionId }: DownloadVersionExportTableProps) => {
  const api = useApi();
  const exports = useServerPaginatedDataGrid({
    fetcher: (_search, pagination) =>
      api.downloadExport.listDownloadVersionExports(downloadId, downloadVersionId, {
        ...pagination,
        sort: pagination.sort ?? 'started_at',
        order: pagination.order ?? 'desc'
      }),
    extractData: (response) => response.exports,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'started_at', sort: 'desc' }
  });
  const columns = useMemo<GridColDef<DownloadExport>[]>(
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
        renderCell: (params) => <Typography variant="body2">{params.value.replaceAll('_', ' ')}</Typography>
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
            color={DOWNLOAD_TABLE_STATUS_CHIP_COLORS[params.value as DownloadExportStatus]}
            sx={{ fontWeight: 700, textTransform: 'capitalize' }}
          />
        )
      },
      {
        field: 'part_count',
        headerName: 'Parts',
        minWidth: 100,
        flex: 0.5,
        renderCell: (params) => <Typography variant="body2">{params.value}</Typography>
      },
      {
        field: 'started_at',
        headerName: 'Started',
        minWidth: 150,
        flex: 0.8,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {getRelativeTimeLabel(typeof params.value === 'string' ? params.value : undefined) ?? '-'}
          </Typography>
        )
      },
      {
        field: 'completed_at',
        headerName: 'Completed',
        minWidth: 150,
        flex: 0.8,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value || ''}>
            {getRelativeTimeLabel(typeof params.value === 'string' ? params.value : undefined) ?? '-'}
          </Typography>
        )
      },
      {
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
      },
      {
        field: 'actions',
        headerName: '',
        minWidth: 140,
        flex: 0.7,
        sortable: false,
        renderCell: ({ row }) => (
          <DownloadVersionExportDownloadButton
            downloadId={downloadId}
            downloadVersionExportId={row.download_version_export_id}
            status={row.status}
            partCount={row.part_count}
          />
        )
      }
    ],
    [downloadId]
  );

  return (
    <PageSection
      id="download-version-exports"
      label={
        <>
          Exports{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({exports.rowCount})
          </Typography>
        </>
      }>
      <ServerPaginatedDataGrid<DownloadExport>
        dataTestId="download-exports-table"
        rows={exports.rows}
        columns={columns}
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
