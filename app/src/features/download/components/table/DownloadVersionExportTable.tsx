import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { keepPreviousDataWithin } from 'utils/query-client';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DOWNLOAD_TABLE_STATUS_CHIP_COLORS } from 'constants/download';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { DownloadExport, DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';
import { useMemo } from 'react';
import { getRelativeTimeLabel } from 'utils/date';
import { downloadQueryKeys } from 'utils/query-keys/download-query-keys';
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
  const exportsGrid = useServerPaginatedGridState({ defaultSort: { field: 'started_at', sort: 'desc' } });
  const exportsPagination = {
    ...exportsGrid.apiPagination,
    sort: exportsGrid.apiPagination.sort ?? 'started_at',
    order: exportsGrid.apiPagination.order ?? 'desc'
  };
  const exportsQuery = useQuery({
    queryKey: downloadQueryKeys.versionExports(downloadId, downloadVersionId, exportsPagination),
    queryFn: ({ signal }) =>
      api.downloadExport.listDownloadVersionExports(downloadId, downloadVersionId, exportsPagination, { signal }),
    placeholderData: keepPreviousDataWithin(downloadQueryKeys.versionExportsAll(downloadId, downloadVersionId))
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
            ({exportsQuery.data?.pagination.total ?? 0})
          </Typography>
        </>
      }>
      <QueryErrorDialog error={exportsQuery.error} label="exports" />
      <ServerPaginatedDataGrid<DownloadExport>
        dataTestId="download-exports-table"
        rows={exportsQuery.data?.exports ?? []}
        columns={columns}
        getRowId={(row) => row.download_version_export_id}
        noRowsMessage="No exports"
        rowCount={exportsQuery.data?.pagination.total ?? 0}
        paginationModel={exportsGrid.paginationModel}
        setPaginationModel={exportsGrid.handlePaginationChange}
        sortModel={exportsGrid.sortModel}
        setSortModel={exportsGrid.handleSortChange}
      />
    </PageSection>
  );
};
