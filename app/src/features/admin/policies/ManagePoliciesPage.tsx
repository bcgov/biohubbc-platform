import Box from '@mui/material/Box';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import Container from '@mui/material/Container';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from 'components/header/PageHeader';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { teamPolicyQueryKeys } from 'utils/query-keys/team-policy-query-keys';
import { teamQueryKeys } from 'utils/query-keys/team-query-keys';
import { PoliciesContainer } from './components/PoliciesContainer';
import { TeamPoliciesContainer } from './components/TeamPoliciesContainer';
import { TeamsContainer } from './components/TeamsContainer';

/**
 * Admin page for managing policies, teams, and team-policy assignments.
 *
 * Each table keeps its page, sort and search as local state and loads the matching page through a query; a
 * container's `refresh` refreshes every cached query its change makes out of date, its own table included.
 *
 * @returns {*}
 */
export const ManagePoliciesPage = () => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();

  const policiesGrid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const policiesSearch = { search: policiesGrid.debouncedSearchTerm };
  const policiesQuery = useQuery({
    queryKey: policyQueryKeys.list(policiesSearch, policiesGrid.apiPagination),
    queryFn: ({ signal }) => biohubApi.policies.getPolicies(policiesSearch, policiesGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  const teamsGrid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const teamsSearch = { search: teamsGrid.debouncedSearchTerm };
  const teamsQuery = useQuery({
    queryKey: teamQueryKeys.list(teamsSearch, teamsGrid.apiPagination),
    queryFn: ({ signal }) => biohubApi.teams.getTeams(teamsSearch, teamsGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  const teamPoliciesGrid = useServerPaginatedGridState({ defaultSort: { field: 'team_name', sort: 'asc' } });
  const teamPoliciesSearch = { search: teamPoliciesGrid.debouncedSearchTerm };
  const teamPoliciesQuery = useQuery({
    queryKey: teamPolicyQueryKeys.list(teamPoliciesSearch, teamPoliciesGrid.apiPagination),
    queryFn: ({ signal }) =>
      biohubApi.teamPolicies.getTeamPolicies(teamPoliciesSearch, teamPoliciesGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  /**
   * Refreshes everything a policy change makes out of date: the policies and assignments tables, cached policy pages,
   * and ticket timelines, which show the status of the data requests (policies) they link to.
   *
   * @returns {void}
   */
  const refreshPolicies = () =>
    refreshChangedQueries(queryClient, [...changedQueryKeys.policy(), ...changedQueryKeys.ticketDetails()]);

  /**
   * Refreshes everything a team change makes out of date: the teams and assignments tables, and the teams listed on
   * cached policy pages.
   *
   * @returns {void}
   */
  const refreshTeams = () => refreshChangedQueries(queryClient, changedQueryKeys.team());

  /**
   * Refreshes everything an assignment change makes out of date: the assignments table, and the teams listed on
   * cached policy pages.
   *
   * @returns {void}
   */
  const refreshTeamPolicies = () => refreshChangedQueries(queryClient, changedQueryKeys.teamPolicy());

  return (
    <>
      <PageHeader label="Manage Policies" />
      <Box py={4}>
        <PoliciesContainer
          policies={policiesQuery.data?.policies ?? []}
          rowCount={policiesQuery.data?.pagination.total ?? 0}
          paginationModel={policiesGrid.paginationModel}
          setPaginationModel={policiesGrid.handlePaginationChange}
          sortModel={policiesGrid.sortModel}
          setSortModel={policiesGrid.handleSortChange}
          refresh={refreshPolicies}
          searchTerm={policiesGrid.searchTerm}
          onSearch={policiesGrid.handleSearch}
        />

        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <TeamsContainer
            teams={teamsQuery.data?.teams ?? []}
            rowCount={teamsQuery.data?.pagination.total ?? 0}
            paginationModel={teamsGrid.paginationModel}
            setPaginationModel={teamsGrid.handlePaginationChange}
            sortModel={teamsGrid.sortModel}
            setSortModel={teamsGrid.handleSortChange}
            refresh={refreshTeams}
            searchTerm={teamsGrid.searchTerm}
            onSearch={teamsGrid.handleSearch}
          />
        </Container>

        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <TeamPoliciesContainer
            teamPolicies={teamPoliciesQuery.data?.team_policies ?? []}
            rowCount={teamPoliciesQuery.data?.pagination.total ?? 0}
            paginationModel={teamPoliciesGrid.paginationModel}
            setPaginationModel={teamPoliciesGrid.handlePaginationChange}
            sortModel={teamPoliciesGrid.sortModel}
            setSortModel={teamPoliciesGrid.handleSortChange}
            refresh={refreshTeamPolicies}
            searchTerm={teamPoliciesGrid.searchTerm}
            onSearch={teamPoliciesGrid.handleSearch}
          />
        </Container>
      </Box>
    </>
  );
};
