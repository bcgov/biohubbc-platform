import { keepPreviousDataWithin } from 'utils/query-client';
import { GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { useMemo } from 'react';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';

interface PolicyTeamsProps {
  policyId: string;
}

/**
 * Teams tab for the policy detail page.
 *
 * @param {PolicyTeamsProps} props
 * @returns {JSX.Element}
 */
export const PolicyTeams = ({ policyId }: PolicyTeamsProps) => {
  const api = useApi();

  const teamsGrid = useServerPaginatedGridState({ defaultSort: { field: 'team_name', sort: 'asc' } });
  const teamsQuery = useQuery({
    queryKey: policyQueryKeys.teams(policyId, teamsGrid.apiPagination),
    queryFn: ({ signal }) => api.policies.getPolicyTeams(policyId, teamsGrid.apiPagination, { signal }),
    placeholderData: keepPreviousDataWithin(policyQueryKeys.policy(policyId))
  });

  const columns = useMemo<GridColDef<ITeamPolicyDetails>[]>(
    () => [
      {
        field: 'team_name',
        headerName: 'Team',
        flex: 1,
        minWidth: 220
      },
      {
        field: 'team_id',
        headerName: 'Team ID',
        flex: 1,
        minWidth: 260
      }
    ],
    []
  );

  return (
    <PageSection id="policy-teams" label="Teams">
      <ServerPaginatedDataGrid<ITeamPolicyDetails>
        dataTestId="policy-teams-table"
        rows={teamsQuery.data?.teams ?? []}
        columns={columns}
        getRowId={(row) => row.team_policy_id}
        noRowsMessage="No Teams"
        rowCount={teamsQuery.data?.pagination.total ?? 0}
        paginationModel={teamsGrid.paginationModel}
        setPaginationModel={teamsGrid.handlePaginationChange}
        sortModel={teamsGrid.sortModel}
        setSortModel={teamsGrid.handleSortChange}
      />
    </PageSection>
  );
};
