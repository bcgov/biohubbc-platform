import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { AdminSubmissionListItem } from 'interfaces/useSubmissionsApi.interface';
import { useNavigate } from 'react-router-dom';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { getFormattedDate } from 'utils/Utils';

const columns: GridColDef<AdminSubmissionListItem>[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 2,
    minWidth: 250
  },
  {
    field: 'contributor_name',
    headerName: 'Contributor',
    flex: 1,
    minWidth: 180
  },
  {
    field: 'submitted_timestamp',
    headerName: 'Submitted',
    width: 160,
    valueFormatter: (value: string) => getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, value)
  },
  {
    field: 'publish_timestamp',
    headerName: 'Published',
    width: 160,
    valueFormatter: (value: string | null) =>
      value ? getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, value) : 'Not published'
  }
];

/**
 * Submissions tab of the administrative submissions page: every submission in the system, with its contributor and
 * when it was submitted and published. Each submission opens its own page. The table keeps its page, sort and search
 * as local state and loads the matching page through a query.
 *
 * @returns {JSX.Element} Submissions table.
 */
export const AdminSubmissionsSubmissionsContent = () => {
  const biohubApi = useApi();
  const navigate = useNavigate();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'submitted_timestamp', sort: 'desc' } });
  const filters = { search: grid.debouncedSearchTerm };
  const submissionsQuery = useQuery({
    queryKey: submissionQueryKeys.adminSubmissionList(filters, grid.apiPagination),
    queryFn: ({ signal }) => biohubApi.submissions.getAdminSubmissionList(filters, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const rowCount = submissionsQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={submissionsQuery.error} label="submissions" />
      <PageSection
        id="admin-submissions"
        label={
          <>
            Submissions{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        headerContent={
          <TextField
            size="small"
            placeholder="Search by name"
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
        <ServerPaginatedDataGrid<AdminSubmissionListItem>
          dataTestId="admin-submissions-table"
          rows={submissionsQuery.data?.submissions ?? []}
          columns={columns}
          getRowId={(row) => row.submission_id}
          noRowsMessage="No Submissions"
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onRowClick={(row) => navigate(`/admin/submissions/${row.submission_id}`)}
        />
      </PageSection>
    </>
  );
};
