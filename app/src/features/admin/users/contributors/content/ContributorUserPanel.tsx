import { Alert, Chip, Skeleton, Stack } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import SearchTextField from 'components/fields/SearchTextField';
import { PageSection } from 'components/section/PageSection';
import { CONTRIBUTOR_STATUS_PRESENTATION } from 'constants/contributor';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
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
  const [error, setError] = useState('');
  const grid = useServerPaginatedDataGrid({
    fetcher: async (keyword, pagination) => {
      setError('');
      try {
        return await api.contributors.listContributorUsers(
          { keyword, contributor_id: contributor.contributor_id },
          pagination
        );
      } catch (caughtError) {
        setError((caughtError as Error).message);
        throw caughtError;
      }
    },
    extractData: (response) => response.contributor_users,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'user_identifier', sort: 'asc' },
    defaultPageSize: 10
  });
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
      renderCell: ({ row }) => <ContributorUserActions record={row} onChanged={grid.refresh} />
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
      {error && (
        <Alert severity="error" action={<SecondaryButton onClick={grid.refresh}>Retry</SecondaryButton>}>
          {error}
        </Alert>
      )}
      {!grid.response && grid.isLoading ? (
        <Stack gap={1} aria-label="Loading contributor users">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} variant="rectangular" height={48} />
          ))}
        </Stack>
      ) : (
        <ServerPaginatedDataGrid
          sx={{ '& .MuiDataGrid-cell': { cursor: 'default' } }}
          rows={grid.rows}
          columns={columns}
          getRowId={(row) => row.contributor_system_user_id}
          dataTestId="contributor_users-table"
          noRowsMessage="No contributor users"
          rowCount={grid.rowCount}
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
          onSaved={() => grid.handlePaginationChange({ ...grid.paginationModel, page: 0 })}
        />
      )}
    </PageSection>
  );
};
