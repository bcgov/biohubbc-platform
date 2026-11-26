import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { POLICY_STATUS_COLORS, POLICY_STATUS_LABELS } from 'constants/policy';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { IServerPaginationProps } from 'types/pagination';
import { getFormattedDate } from 'utils/Utils';

interface IPortalDataRequestsContentProps extends IServerPaginationProps {
  rows: DataRequestResponse[];
  rowCount: number;
}

const columns: GridColDef<DataRequestResponse>[] = [
  {
    field: 'reason',
    headerName: 'Description',
    flex: 1,
    minWidth: 320
  },
  {
    field: 'status',
    headerName: 'Decision',
    width: 170,
    renderCell: (params) => (
      <Chip
        label={POLICY_STATUS_LABELS[params.row.status]}
        size="small"
        color={POLICY_STATUS_COLORS[params.row.status]}
        sx={{ fontWeight: 700 }}
      />
    )
  },
  {
    field: 'create_date',
    headerName: 'Date',
    width: 160,
    valueFormatter: (value: string) => getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, value)
  }
];

/**
 * Data requests table of the portal: one server-paginated page of the data requests made for the current user's
 * teams, with their decision and date, newest first by default.
 *
 * @param {IPortalDataRequestsContentProps} props - Data request rows, their total, and the pagination and sort state.
 * @returns {JSX.Element} The data requests section and table.
 */
export const PortalDataRequestsContent = (props: IPortalDataRequestsContentProps) => {
  const { rows, rowCount, paginationModel, setPaginationModel, sortModel, setSortModel } = props;

  return (
    <PageSection
      id="portal-data-requests"
      label={
        <>
          Data Requests{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </>
      }>
      <ServerPaginatedDataGrid<DataRequestResponse>
        dataTestId="portal-data-requests-table"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.data_request_id}
        noRowsMessage="No data requests"
        rowCount={rowCount}
        paginationModel={paginationModel}
        setPaginationModel={setPaginationModel}
        sortModel={sortModel}
        setSortModel={setSortModel}
      />
    </PageSection>
  );
};
