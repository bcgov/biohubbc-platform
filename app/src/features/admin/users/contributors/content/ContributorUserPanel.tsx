import { Alert, Chip, Skeleton, Stack } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import SearchTextField from 'components/fields/SearchTextField';
import { PageSection } from 'components/section/PageSection';
import { CONTRIBUTOR_STATUS_PRESENTATION } from 'constants/contributor';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { refreshChangedQueries } from 'utils/query-client';
import { IContributor, IContributorUser } from 'interfaces/useContributorsApi.interface';
import { useState } from 'react';
import { ContributorUserDialog } from '../dialog/ContributorUserDialog';
import { ContributorUserActions } from '../table/ContributorUserActions';

/**
 * Paginated contributor users with administrative create, edit and delete actions.
 * @param props - Contributor whose relationships are managed on its details page.
 * @returns Searchable administrative table and creation dialog.
 */
export const ContributorUserPanel = ({ contributor }: { contributor: IContributor }) => {
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'user_identifier', sort: 'asc' } });
  const scopeKey = ['administration', 'contributors', contributor.contributor_id, 'users'];
  const query = useQuery({
    queryKey: [...scopeKey, grid.debouncedSearchTerm, grid.apiPagination],
    queryFn: () =>
      api.contributors.listContributorUsers(
        { keyword: grid.debouncedSearchTerm, contributor_id: contributor.contributor_id },
        grid.apiPagination
      ),
    placeholderData: keepPreviousData
  });

  /**
   * Refresh this contributor's relationships after administrative changes.
   *
   * @returns Resolves after mounted relationship lists refresh.
   */
  const refresh = () => refreshChangedQueries(queryClient, [scopeKey]);
  const columns: GridColDef<IContributorUser>[] = [
    {
      field: 'system_user_id',
      headerName: 'System user ID',
      minWidth: 160,
      sortable: false
    },
    {
      field: 'user_identifier',
      headerName: 'System user',
      minWidth: 220,
      flex: 1,
      renderCell: ({ row }) => row.display_name || row.user_identifier
    },
    {
      field: 'record_end_date',
      headerName: 'Status',
      minWidth: 140,
      flex: 0.8,
      renderCell: ({ row }) => {
        const status = CONTRIBUTOR_STATUS_PRESENTATION[row.record_end_date ? 'ended' : 'active'];
        return <Chip label={status.label} size="small" color={status.colour} sx={{ fontWeight: 700 }} />;
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: ({ row }) => <ContributorUserActions record={row} onChanged={refresh} />
    }
  ];
  return (
    <PageSection
      id="contributor_users"
      label="Users"
      onAdd={contributor.record_end_date ? undefined : () => setAdding(true)}
      addLabel="Add Contributor User"
      headerContent={
        <SearchTextField
          size="small"
          placeholder="Search contributor users"
          value={grid.searchTerm}
          onChange={(event) => grid.handleSearch(event.target.value)}
        />
      }>
      {query.error && (
        <Alert severity="error" action={<SecondaryButton onClick={refresh}>Retry</SecondaryButton>}>
          {query.error.message}
        </Alert>
      )}
      {query.isPending ? (
        <Stack gap={1} aria-label="Loading contributor users">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} variant="rectangular" height={48} />
          ))}
        </Stack>
      ) : (
        <ServerPaginatedDataGrid
          sx={{ '& .MuiDataGrid-cell': { cursor: 'default' } }}
          rows={query.data?.contributor_users ?? []}
          columns={columns}
          getRowId={(row) => row.contributor_system_user_id}
          dataTestId="contributor_users-table"
          noRowsMessage="No contributor users"
          rowCount={query.data?.pagination.total ?? 0}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
        />
      )}
      {adding && (
        <ContributorUserDialog
          contributor={contributor}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            grid.handlePaginationChange({ ...grid.paginationModel, page: 0 });
            await refresh();
          }}
        />
      )}
    </PageSection>
  );
};
