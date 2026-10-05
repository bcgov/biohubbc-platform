import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { DOWNLOAD_STATUS_CHIP_PROPS } from 'constants/download';
import { DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { IServerPaginationProps } from 'types/pagination';
import { getFormattedDate } from 'utils/Utils';

interface IPortalDownloadsContainerProps extends IServerPaginationProps {
  rows: DownloadRecord[];
  rowCount: number;
  onRowClick: (downloadId: string) => void;
}

const columns: GridColDef<DownloadRecord>[] = [
  {
    field: 'name',
    headerName: 'Name',
    minWidth: 260,
    flex: 1.2,
    renderCell: (params) => (
      <Typography variant="body2" noWrap title={params.value || ''}>
        {params.value}
      </Typography>
    )
  },
  {
    field: 'description',
    headerName: 'Description',
    minWidth: 320,
    flex: 1.5,
    sortable: false,
    renderCell: (params) => (
      <Typography variant="body2" noWrap title={params.value || ''}>
        {params.value || '—'}
      </Typography>
    )
  },
  {
    field: 'download_status',
    headerName: 'Status',
    minWidth: 130,
    flex: 0.6,
    renderCell: (params) => {
      const chipProps = DOWNLOAD_STATUS_CHIP_PROPS[params.row.download_status];
      return <Chip label={chipProps.label} size="small" color={chipProps.color} sx={{ fontWeight: 700 }} />;
    }
  },
  {
    field: 'create_date',
    headerName: 'Created',
    minWidth: 160,
    flex: 0.7,
    valueGetter: (_value, row) => getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, row.create_date)
  }
];

/**
 * Renders the Portal's server-paginated downloads table.
 *
 * @param {IPortalDownloadsContainerProps} props - Download rows, pagination state, and navigation callback.
 * @return {JSX.Element} The downloads section and table.
 */
export const PortalDownloadsContainer = (props: IPortalDownloadsContainerProps) => {
  const { rows, rowCount, paginationModel, setPaginationModel, sortModel, setSortModel, onRowClick } = props;

  return (
    <PageSection
      id="portal-downloads"
      label={
        <>
          Downloads{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </>
      }>
      <ServerPaginatedDataGrid<DownloadRecord>
        dataTestId="portal-downloads-table"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.download_id}
        noRowsMessage="No downloads"
        rowCount={rowCount}
        paginationModel={paginationModel}
        setPaginationModel={setPaginationModel}
        sortModel={sortModel}
        setSortModel={setSortModel}
        onRowClick={(row) => onRowClick(row.download_id)}
      />
    </PageSection>
  );
};
