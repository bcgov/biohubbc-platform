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
import { IContributor } from 'interfaces/useContributorsApi.interface';
import { useState } from 'react';
import { ContributorDialog } from '../dialog/ContributorDialog';
import { ContributorActions } from '../table/ContributorActions';

/**
 * Paginated contributors with administrative create, edit and delete actions.
 *
 * @returns Searchable administrative table and creation dialog.
 */
export const ContributorPanel = () => {
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'client_id', sort: 'asc' } });
  const query = useQuery({
    queryKey: ['administration', 'contributors', grid.debouncedSearchTerm, grid.apiPagination],
    queryFn: () => api.contributors.listContributors({ keyword: grid.debouncedSearchTerm }, grid.apiPagination),
    placeholderData: keepPreviousData
  });

  /**
   * Refresh contributor lists after administrative changes.
   *
   * @returns Resolves after mounted contributor lists refresh.
   */
  const refresh = () => refreshChangedQueries(queryClient, [['administration', 'contributors']]);
  const columns: GridColDef<IContributor>[] = [
    { field: 'contributor_id', headerName: 'Contributor ID', width: 140 },
    {
      field: 'client_id',
      headerName: 'Client ID',
      minWidth: 200,
      flex: 1
    },
    { field: 'description', headerName: 'Description', minWidth: 250, flex: 1 },
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
      renderCell: ({ row }) => <ContributorActions record={row} onChanged={refresh} />
    }
  ];
  return (
    <PageSection
      id="contributors"
      label="Contributors"
      onAdd={() => setAdding(true)}
      addLabel="Add Contributor"
      headerContent={
        <SearchTextField
          size="small"
          placeholder="Search contributors"
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
        <Stack gap={1} aria-label="Loading contributors">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} variant="rectangular" height={48} />
          ))}
        </Stack>
      ) : (
        <ServerPaginatedDataGrid
          rows={query.data?.contributors ?? []}
          columns={columns}
          getRowId={(row) => row.contributor_id}
          dataTestId="contributors-table"
          noRowsMessage="No contributors"
          rowCount={query.data?.pagination.total ?? 0}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
        />
      )}
      {adding && (
        <ContributorDialog
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
