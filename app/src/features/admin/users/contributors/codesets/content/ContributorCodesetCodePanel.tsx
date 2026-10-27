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
import { IContributorCodeset, IContributorCodesetCode } from 'interfaces/useContributorsApi.interface';

/**
 * Paginated, read-only table of a codeset's codes. Contributor codes are managed through contributor
 * ingestion, so no actions are offered.
 *
 * @param props - Codeset whose codes are listed.
 * @returns Code section and table.
 */
export const ContributorCodesetCodePanel = ({ codeset }: { codeset: IContributorCodeset }) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'key', sort: 'asc' } });
  const scopeKey = [
    'administration',
    'contributors',
    codeset.contributor_id,
    'codesets',
    codeset.contributor_codeset_id,
    'codes'
  ];
  const query = useQuery({
    queryKey: [...scopeKey, grid.apiPagination],
    queryFn: () =>
      api.contributors.listContributorCodesetCodes(
        codeset.contributor_id,
        codeset.contributor_codeset_id,
        grid.apiPagination
      ),
    placeholderData: keepPreviousData
  });

  /**
   * Refresh the codeset's codes after a failed load.
   *
   * @returns Resolves after mounted code lists refresh.
   */
  const refresh = () => refreshChangedQueries(queryClient, [scopeKey]);
  const columns: GridColDef<IContributorCodesetCode>[] = [
    { field: 'codeset_label', headerName: 'Codeset', minWidth: 160, flex: 1, sortable: false },
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
      id="contributor_codeset_codes"
      label={
        <>
          Codes{' '}
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
        <Stack gap={1} aria-label="Loading codes">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} variant="rectangular" height={48} />
          ))}
        </Stack>
      ) : (
        <ServerPaginatedDataGrid
          sx={{ '& .MuiDataGrid-cell': { cursor: 'default' } }}
          rows={query.data?.codes ?? []}
          columns={columns}
          getRowId={(row) => row.contributor_codeset_code_id}
          dataTestId="contributor_codeset_codes-table"
          noRowsMessage="No codes"
          rowCount={query.data?.pagination.total ?? 0}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
        />
      )}
    </PageSection>
  );
};
