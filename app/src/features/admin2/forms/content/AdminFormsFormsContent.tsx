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
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { IFormListItem } from 'interfaces/useFormsApi.interface';
import { useNavigate } from 'react-router-dom';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { getFormattedDate } from 'utils/Utils';

const columns: GridColDef<IFormListItem>[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 2,
    minWidth: 250
  },
  {
    field: 'slug',
    headerName: 'Slug',
    flex: 1,
    minWidth: 160,
    sortable: false
  },
  {
    field: 'is_public',
    headerName: 'Access',
    width: 120,
    sortable: false,
    valueGetter: (value: boolean) => (value ? 'Public' : 'Teams')
  },
  {
    field: 'version_number',
    headerName: 'Version',
    width: 120,
    sortable: false
  },
  {
    field: 'record_effective_date',
    headerName: 'Status',
    width: 150,
    sortable: false,
    renderCell: (params) => (
      <Chip
        label={params.row.record_effective_date ? 'Published' : 'Draft'}
        size="small"
        color={params.row.record_effective_date ? 'success' : 'default'}
        sx={{ fontWeight: 700 }}
      />
    )
  },
  {
    field: 'create_date',
    headerName: 'Created',
    width: 160,
    valueFormatter: (value: string) => getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, value)
  }
];

/**
 * Forms tab of the administrative forms page: every active form, with its latest version and whether that version
 * is published. Each form opens its latest version in the form builder. The table keeps its page, sort and search as
 * local state and loads the matching page through a query.
 *
 * @returns {JSX.Element} Forms table.
 */
export const AdminFormsFormsContent = () => {
  const biohubApi = useApi();
  const navigate = useNavigate();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const filters = { keyword: grid.debouncedSearchTerm || undefined };
  const formsQuery = useQuery({
    queryKey: formQueryKeys.list(filters, grid.apiPagination),
    queryFn: ({ signal }) => biohubApi.forms.getForms(filters, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const rowCount = formsQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={formsQuery.error} label="forms" />
      <PageSection
        id="forms"
        label={
          <>
            Forms{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        headerContent={
          <TextField
            size="small"
            placeholder="Search by name or slug"
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
        <ServerPaginatedDataGrid<IFormListItem>
          dataTestId="forms-table"
          rows={formsQuery.data?.forms ?? []}
          columns={columns}
          getRowId={(row) => row.form_id}
          noRowsMessage="No Forms"
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onRowClick={(row) => {
            if (row.form_version_id) {
              navigate(`/admin/forms/${row.form_id}/versions/${row.form_version_id}`);
            }
          }}
        />
      </PageSection>
    </>
  );
};
