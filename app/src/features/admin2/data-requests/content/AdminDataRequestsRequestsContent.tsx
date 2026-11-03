import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { POLICY_STATUS_COLORS, POLICY_STATUS_LABELS } from 'constants/policy';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { DataRequestListItem } from 'interfaces/useDataRequestApi.interface';
import { useNavigate } from 'react-router-dom';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { getFormattedDate } from 'utils/Utils';

const columns: GridColDef<DataRequestListItem>[] = [
  {
    field: 'reason',
    headerName: 'Description',
    flex: 2,
    minWidth: 250
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
  },
  {
    field: 'requested_by_name',
    headerName: 'Submitted By',
    flex: 1,
    minWidth: 180
  }
];

/**
 * Requests tab of the administrative data requests page: every data request in the system, with its decision, date
 * and the user who submitted it. Each request opens its own page. The table keeps its page, sort and search as local
 * state and loads the matching page through a query.
 *
 * @returns {JSX.Element} Data requests table.
 */
export const AdminDataRequestsRequestsContent = () => {
  const biohubApi = useApi();
  const navigate = useNavigate();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'create_date', sort: 'desc' } });
  const search = { search: grid.debouncedSearchTerm };
  const dataRequestsQuery = useQuery({
    queryKey: policyQueryKeys.dataRequests(search, grid.apiPagination),
    queryFn: ({ signal }) => biohubApi.dataRequest.getDataRequests(search, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const rowCount = dataRequestsQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={dataRequestsQuery.error} label="data requests" />
      <PageSection
        id="data-requests"
        label={
          <>
            Requests{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        headerContent={
          <TextField
            size="small"
            placeholder="Search by description"
            value={grid.searchTerm}
            onChange={(event) => grid.handleSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon path={mdiMagnify} size={0.875} />
                  </InputAdornment>
                )
              }
            }}
            sx={{ width: 250 }}
          />
        }>
        <ServerPaginatedDataGrid<DataRequestListItem>
          dataTestId="data-requests-table"
          rows={dataRequestsQuery.data?.data_requests ?? []}
          columns={columns}
          getRowId={(row) => row.data_request_id}
          noRowsMessage="No Data Requests"
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onRowClick={(row) => navigate(`/admin/data-requests/${row.data_request_id}`)}
        />
      </PageSection>
    </>
  );
};
