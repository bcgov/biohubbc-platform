import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IPolicyTeamsResponse } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { useMemo } from 'react';

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

  const teams = useServerPaginatedDataGrid<ITeamPolicyDetails, IPolicyTeamsResponse>({
    fetcher: (_search, pagination) => api.policies.getPolicyTeams(policyId, pagination),
    extractData: (response) => response.teams,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'team_name', sort: 'asc' }
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
        rows={teams.rows}
        columns={columns}
        getRowId={(row) => row.team_policy_id}
        noRowsMessage="No Teams"
        rowCount={teams.rowCount}
        paginationModel={teams.paginationModel}
        setPaginationModel={teams.handlePaginationChange}
        sortModel={teams.sortModel}
        setSortModel={teams.handleSortChange}
      />
    </PageSection>
  );
};
