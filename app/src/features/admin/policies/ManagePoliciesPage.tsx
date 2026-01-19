import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/misc';
import { firstOrNull } from 'utils/Utils';
import { ActivePoliciesList } from './components/ActivePoliciesList';
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

  // Selection state
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Policy search state
  const [policySearchTerm, setPolicySearchTerm] = useState('');
  const [debouncedPolicySearchTerm, setDebouncedPolicySearchTerm] = useState('');

  // Team search state
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [debouncedTeamSearchTerm, setDebouncedTeamSearchTerm] = useState('');

  // Policies pagination state
  const [policiesPaginationModel, setPoliciesPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10
  });
  const [policiesSortModel, setPoliciesSortModel] = useState<GridSortModel>([{ field: 'name', sort: 'asc' }]);

  // Teams pagination state
  const [teamsPaginationModel, setTeamsPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 10 });
  const [teamsSortModel, setTeamsSortModel] = useState<GridSortModel>([{ field: 'name', sort: 'asc' }]);

  // TeamPolicies pagination state
  const [teamPoliciesPaginationModel, setTeamPoliciesPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10
  });
  const [teamPoliciesSortModel, setTeamPoliciesSortModel] = useState<GridSortModel>([
    { field: 'team_name', sort: 'asc' }
  ]);

  // Policies pagination options (memoized to prevent unnecessary re-renders)
  const policiesPagination: ApiPaginationRequestOptions = useMemo(() => {
    const sort = firstOrNull(policiesSortModel);
    return {
      page: policiesPaginationModel.page + 1,
      limit: policiesPaginationModel.pageSize,
      sort: sort?.field,
      order: sort?.sort as 'asc' | 'desc' | undefined
    };
  }, [policiesPaginationModel, policiesSortModel]);

  // Teams pagination options (memoized to prevent unnecessary re-renders)
  const teamsPagination: ApiPaginationRequestOptions = useMemo(() => {
    const sort = firstOrNull(teamsSortModel);
    return {
      page: teamsPaginationModel.page + 1,
      limit: teamsPaginationModel.pageSize,
      sort: sort?.field,
      order: sort?.sort as 'asc' | 'desc' | undefined
    };
  }, [teamsPaginationModel, teamsSortModel]);

  // TeamPolicies pagination options (memoized to prevent unnecessary re-renders)
  const teamPoliciesPagination: ApiPaginationRequestOptions = useMemo(() => {
    const sort = firstOrNull(teamPoliciesSortModel);
    return {
      page: teamPoliciesPaginationModel.page + 1,
      limit: teamPoliciesPaginationModel.pageSize,
      sort: sort?.field,
      order: sort?.sort as 'asc' | 'desc' | undefined
    };
  }, [teamPoliciesPaginationModel, teamPoliciesSortModel]);

  // Data loaders
  const policiesDataLoader = useDataLoader((pagination: ApiPaginationRequestOptions, search?: string) =>
    biohubApi.policies.getPolicies({ search }, pagination)
  );

  const teamsDataLoader = useDataLoader((pagination: ApiPaginationRequestOptions, search?: string) =>
    biohubApi.teams.getTeams({ search }, pagination)
  );

  const teamPoliciesDataLoader = useDataLoader((pagination: ApiPaginationRequestOptions) =>
    biohubApi.teamPolicies.getTeamPolicies(pagination)
  );

  // Load data on mount
  useEffect(() => {
    policiesDataLoader.load(policiesPagination, debouncedPolicySearchTerm);
    teamsDataLoader.load(teamsPagination, debouncedTeamSearchTerm);
    teamPoliciesDataLoader.load(teamPoliciesPagination);
  }, [
    teamPoliciesDataLoader,
    teamsDataLoader,
    policiesDataLoader,
    debouncedPolicySearchTerm,
    debouncedTeamSearchTerm,
    policiesPagination,
    teamsPagination,
    teamPoliciesPagination
  ]);

  // Refresh policies when pagination/sort changes
  useEffect(() => {
    policiesDataLoader.refresh(policiesPagination, debouncedPolicySearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policiesPagination]);

  // Refresh teams when pagination/sort changes
  useEffect(() => {
    teamsDataLoader.refresh(teamsPagination, debouncedTeamSearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsPagination]);

  // Refresh teamPolicies when pagination/sort changes
  useEffect(() => {
    teamPoliciesDataLoader.refresh(teamPoliciesPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamPoliciesPagination]);

  // Data
  const policies = policiesDataLoader.data?.policies ?? [];
  const teams = teamsDataLoader.data?.teams ?? [];
  const teamPolicies = useMemo(
    () => teamPoliciesDataLoader.data?.team_policies ?? [],
    [teamPoliciesDataLoader.data?.team_policies]
  );

  // Filter team-policies based on selection
  const filteredTeamPolicies = useMemo(() => {
    let result = teamPolicies;

    if (selectedTeamId) {
      result = result.filter((tp) => tp.team_id === selectedTeamId);
    }
    if (selectedPolicyId) {
      result = result.filter((tp) => tp.policy_id === selectedPolicyId);
    }

    return result;
  }, [teamPolicies, selectedTeamId, selectedPolicyId]);

  // Get selected objects for TeamPoliciesContainer
  const selectedTeam = teams.find((t) => t.team_id === selectedTeamId) ?? null;
  const selectedPolicy = policies.find((p) => p.policy_id === selectedPolicyId) ?? null;

  // Debounced search handlers
  const debouncedPolicyRefresh = useMemo(
    () =>
      debounce((term: string, pagination: ApiPaginationRequestOptions) => {
        setDebouncedPolicySearchTerm(term);
        policiesDataLoader.refresh(pagination, term);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const debouncedTeamRefresh = useMemo(
    () =>
      debounce((term: string, pagination: ApiPaginationRequestOptions) => {
        setDebouncedTeamSearchTerm(term);
        teamsDataLoader.refresh(pagination, term);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handlePolicySearch = useCallback(
    (term: string) => {
      setPolicySearchTerm(term);
      // Reset to first page when searching
      setPoliciesPaginationModel((prev) => ({ ...prev, page: 0 }));
      debouncedPolicyRefresh(term, { ...policiesPagination, page: 1 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [policiesPagination]
  );

  const handleTeamSearch = useCallback(
    (term: string) => {
      setTeamSearchTerm(term);
      // Reset to first page when searching
      setTeamsPaginationModel((prev) => ({ ...prev, page: 0 }));
      debouncedTeamRefresh(term, { ...teamsPagination, page: 1 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamsPagination]
  );

  // Selection handlers
  const handleSelectPolicy = useCallback((policyId: string | null) => {
    setSelectedPolicyId(policyId);
  }, []);

  const handleSelectTeam = useCallback((teamId: string | null) => {
    setSelectedTeamId(teamId);
  }, []);

  // Refresh handlers
  const refreshPolicies = useCallback(() => {
    policiesDataLoader.refresh(policiesPagination, debouncedPolicySearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPolicySearchTerm, policiesPagination]);

  const refreshTeams = useCallback(() => {
    teamsDataLoader.refresh(teamsPagination, debouncedTeamSearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTeamSearchTerm, teamsPagination]);

  const refreshTeamPolicies = useCallback(() => {
    teamPoliciesDataLoader.refresh(teamPoliciesPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamPoliciesPagination]);

  return (
    <Box py={7}>
      <ActivePoliciesList
        policies={policies}
        rowCount={policiesDataLoader.data?.pagination.total ?? 0}
        paginationModel={policiesPaginationModel}
        setPaginationModel={setPoliciesPaginationModel}
        sortModel={policiesSortModel}
        setSortModel={setPoliciesSortModel}
        refresh={refreshPolicies}
        searchTerm={policySearchTerm}
        onSearch={handlePolicySearch}
        selectedPolicyId={selectedPolicyId}
        onSelectPolicy={handleSelectPolicy}
      />

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper>
          <TeamsContainer
            teams={teams}
            rowCount={teamsDataLoader.data?.pagination.total ?? 0}
            paginationModel={teamsPaginationModel}
            setPaginationModel={setTeamsPaginationModel}
            sortModel={teamsSortModel}
            setSortModel={setTeamsSortModel}
            refresh={refreshTeams}
            searchTerm={teamSearchTerm}
            onSearch={handleTeamSearch}
            selectedTeamId={selectedTeamId}
            onSelectTeam={handleSelectTeam}
          />
        </Paper>
      </Container>

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper>
          <TeamPoliciesContainer
            teamPolicies={filteredTeamPolicies}
            rowCount={teamPoliciesDataLoader.data?.pagination.total ?? 0}
            paginationModel={teamPoliciesPaginationModel}
            setPaginationModel={setTeamPoliciesPaginationModel}
            sortModel={teamPoliciesSortModel}
            setSortModel={setTeamPoliciesSortModel}
            selectedTeam={selectedTeam}
            selectedPolicy={selectedPolicy}
            refresh={refreshTeamPolicies}
          />
        </Paper>
      </Container>
    </Box>
  );
};
