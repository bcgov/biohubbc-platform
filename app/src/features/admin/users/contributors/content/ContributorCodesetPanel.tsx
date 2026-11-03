import { Alert, Chip, Skeleton, Stack, Typography } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { CONTRIBUTOR_STATUS_PRESENTATION } from 'constants/contributor';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { refreshChangedQueries } from 'utils/query-client';
import { IContributor, IContributorCodeset } from 'interfaces/useContributorsApi.interface';
import { useNavigate } from 'react-router-dom';

/**
 * Paginated, read-only table of a contributor's codesets. Selecting a row opens that codeset's page.
 *
 * @param props - Contributor whose codesets are listed.
 * @returns Codeset section and table.
 */
export const ContributorCodesetPanel = ({ contributor }: { contributor: IContributor }) => {
  const api = useApi();
  const navigate = useNavigate();
  const handleRowClick = (codeset: IContributorCodeset) => {
    navigate(`/admin/users/contributor/${contributor.contributor_id}/codeset/${codeset.contributor_codeset_id}`);
  };
  const queryClient = useQueryClient();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'key', sort: 'asc' } });
  const scopeKey = ['administration', 'contributors', contributor.contributor_id, 'codesets'];
  const query = useQuery({
    queryKey: [...scopeKey, grid.apiPagination],
    queryFn: () => api.contributors.listContributorCodesets(contributor.contributor_id, grid.apiPagination),
    placeholderData: keepPreviousData
  });

  /**
   * Refresh this contributor's codesets after a failed load.
   *
   * @returns Resolves after mounted codeset lists refresh.
   */
  const refresh = () => refreshChangedQueries(queryClient, [scopeKey]);
  const columns: GridColDef<IContributorCodeset>[] = [
    { field: 'key', headerName: 'Key', minWidth: 160, flex: 1 },
    { field: 'label', headerName: 'Label', minWidth: 180, flex: 1 },
    { field: 'description', headerName: 'Description', minWidth: 220, flex: 1.5, sortable: false },
    { field: 'external_id', headerName: 'External ID', minWidth: 140, flex: 0.8 },
    {
      field: 'record_end_date',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.6,
      renderCell: ({ row }) => {
        const status = CONTRIBUTOR_STATUS_PRESENTATION[row.record_end_date ? 'ended' : 'active'];
        return <Chip label={status.label} size="small" color={status.colour} sx={{ fontWeight: 700 }} />;
      }
    }
  ];
  return (
    <PageSection
      id="contributor_codesets"
      label={
        <>
          Codesets{' '}
          <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
            ({query.data?.pagination.total ?? 0})
          </Typography>
        </>
      }>
      {query.error && (
        <Alert severity="error" action={<SecondaryButton onClick={refresh}>Retry</SecondaryButton>}>
          {query.error.message}
        </Alert>
      )}
      {query.isPending ? (
        <Stack gap={1} aria-label="Loading codesets">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} variant="rectangular" height={48} />
          ))}
        </Stack>
      ) : (
        <ServerPaginatedDataGrid
          rows={query.data?.codesets ?? []}
          columns={columns}
          getRowId={(row) => row.contributor_codeset_id}
          dataTestId="contributor_codesets-table"
          noRowsMessage="No codesets"
          rowCount={query.data?.pagination.total ?? 0}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onRowClick={handleRowClick}
        />
      )}
    </PageSection>
  );
};
