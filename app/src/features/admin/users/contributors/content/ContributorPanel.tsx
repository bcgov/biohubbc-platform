import { Alert, Chip, Skeleton, Stack } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import SearchTextField from 'components/fields/SearchTextField';
import { PageSection } from 'components/section/PageSection';
import { CONTRIBUTOR_STATUS_PRESENTATION } from 'constants/contributor';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
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
  const [error, setError] = useState('');
  const grid = useServerPaginatedDataGrid({
    fetcher: async (keyword, pagination) => {
      setError('');
      try {
        return await api.contributors.listContributors({ keyword }, pagination);
      } catch (caughtError) {
        setError((caughtError as Error).message);
        throw caughtError;
      }
    },
    extractData: (response) => response.contributors,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'client_id', sort: 'asc' },
    defaultPageSize: 10
  });
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
      renderCell: ({ row }) => <ContributorActions record={row} onChanged={grid.refresh} />
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
      {error && (
        <Alert severity="error" action={<SecondaryButton onClick={grid.refresh}>Retry</SecondaryButton>}>
          {error}
        </Alert>
      )}
      {!grid.response && grid.isLoading ? (
        <Stack gap={1} aria-label="Loading contributors">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} variant="rectangular" height={48} />
          ))}
        </Stack>
      ) : (
        <ServerPaginatedDataGrid
          rows={grid.rows}
          columns={columns}
          getRowId={(row) => row.contributor_id}
          dataTestId="contributors-table"
          noRowsMessage="No contributors"
          rowCount={grid.rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
        />
      )}
      {adding && (
        <ContributorDialog
          onClose={() => setAdding(false)}
          onSaved={() => grid.handlePaginationChange({ ...grid.paginationModel, page: 0 })}
        />
      )}
    </PageSection>
  );
};
