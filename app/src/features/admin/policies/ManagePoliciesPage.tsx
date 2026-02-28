import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { PageHeader } from 'components/header/PageHeader';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { toApiPagination, useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { PoliciesContainer } from './components/PoliciesContainer';
import { TeamPoliciesContainer } from './components/TeamPoliciesContainer';
import { TeamsContainer } from './components/TeamsContainer';

/**
 * Admin page for managing policies, teams, and team-policy assignments.
 *
 * Features selection-based workflow:
 * - Select a policy to filter assignments by that policy
 * - Select a team to filter assignments by that team
 * - Select both to see/create specific assignment
 */
export const ManagePoliciesPage = () => {
  const biohubApi = useApi();

  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const policies = useServerPaginatedDataGrid({
    fetcher: (search, pagination) => biohubApi.policies.getPolicies({ search }, pagination),
    extractData: (response) => response.policies,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

  const teams = useServerPaginatedDataGrid({
    fetcher: (search, pagination) => biohubApi.teams.getTeams({ search }, pagination),
    extractData: (response) => response.teams,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'name', sort: 'asc' }
  });

  const [teamPoliciesPaginationModel, setTeamPoliciesPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10
  });
  const [teamPoliciesSortModel, setTeamPoliciesSortModel] = useState<GridSortModel>([
    { field: 'team_name', sort: 'asc' }
  ]);

  const teamPoliciesDataLoader = useDataLoader((pagination: ApiPaginationRequestOptions) =>
    biohubApi.teamPolicies.getTeamPolicies(pagination)
  );

  useEffect(() => {
    teamPoliciesDataLoader.load(toApiPagination(teamPoliciesPaginationModel, teamPoliciesSortModel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTeamPoliciesPaginationChange = useCallback(
    (model: GridPaginationModel) => {
      setTeamPoliciesPaginationModel(model);
      teamPoliciesDataLoader.refresh(toApiPagination(model, teamPoliciesSortModel));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamPoliciesSortModel]
  );

  const handleTeamPoliciesSortChange = useCallback(
    (model: GridSortModel) => {
      setTeamPoliciesSortModel(model);
      teamPoliciesDataLoader.refresh(toApiPagination(teamPoliciesPaginationModel, model));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamPoliciesPaginationModel]
  );

  const refreshTeamPolicies = useCallback(() => {
    teamPoliciesDataLoader.refresh(toApiPagination(teamPoliciesPaginationModel, teamPoliciesSortModel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamPoliciesPaginationModel, teamPoliciesSortModel]);

  const filteredTeamPolicies = useMemo(() => {
    const teamPolicies = teamPoliciesDataLoader.data?.team_policies ?? [];
    let result = teamPolicies;

    if (selectedTeamId) {
      result = result.filter((tp) => tp.team_id === selectedTeamId);
    }
    if (selectedPolicyId) {
      result = result.filter((tp) => tp.policy_id === selectedPolicyId);
    }

    return result;
  }, [teamPoliciesDataLoader.data?.team_policies, selectedTeamId, selectedPolicyId]);

  const selectedTeam = teams.data.find((t) => t.team_id === selectedTeamId) ?? null;
  const selectedPolicy = policies.data.find((p) => p.policy_id === selectedPolicyId) ?? null;

  const handleSelectPolicy = useCallback((policyId: string | null) => {
    setSelectedPolicyId(policyId);
  }, []);

  const handleSelectTeam = useCallback((teamId: string | null) => {
    setSelectedTeamId(teamId);
  }, []);

  return (
    <>
      <PageHeader label="Manage Policies" />
      <Box py={4}>
        <PoliciesContainer
          policies={policies.data}
          rowCount={policies.rowCount}
          paginationModel={policies.paginationModel}
          setPaginationModel={policies.handlePaginationChange}
          sortModel={policies.sortModel}
          setSortModel={policies.handleSortChange}
          refresh={policies.refresh}
          searchTerm={policies.searchTerm}
          onSearch={policies.handleSearch}
          selectedPolicyId={selectedPolicyId}
          onSelectPolicy={handleSelectPolicy}
        />

        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <TeamsContainer
            teams={teams.data}
            rowCount={teams.rowCount}
            paginationModel={teams.paginationModel}
            setPaginationModel={teams.handlePaginationChange}
            sortModel={teams.sortModel}
            setSortModel={teams.handleSortChange}
            refresh={teams.refresh}
            searchTerm={teams.searchTerm}
            onSearch={teams.handleSearch}
            selectedTeamId={selectedTeamId}
            onSelectTeam={handleSelectTeam}
          />
        </Container>

        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <TeamPoliciesContainer
            teamPolicies={filteredTeamPolicies}
            rowCount={teamPoliciesDataLoader.data?.pagination.total ?? 0}
            paginationModel={teamPoliciesPaginationModel}
            setPaginationModel={handleTeamPoliciesPaginationChange}
            sortModel={teamPoliciesSortModel}
            setSortModel={handleTeamPoliciesSortChange}
            selectedTeam={selectedTeam}
            selectedPolicy={selectedPolicy}
            refresh={refreshTeamPolicies}
          />
        </Container>
      </Box>
    </>
  );
};
