import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { PageHeader } from 'components/header/PageHeader';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDebounce from 'hooks/useDebounce';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { useCallback, useEffect, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { toApiPagination } from 'utils/pagination';
import { PoliciesContainer } from './components/PoliciesContainer';
import { TeamPoliciesContainer } from './components/TeamPoliciesContainer';
import { TeamsContainer } from './components/TeamsContainer';

/**
 * Admin page for managing policies, teams, and team-policy assignments.
 *
 * Assignments are created directly from the Add Assignment dialog.
 * Team and policy grids are for management only and do not drive assignment filtering.
 */
export const ManagePoliciesPage = () => {
  const biohubApi = useApi();

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
  const [teamPoliciesSearchTerm, setTeamPoliciesSearchTerm] = useState('');
  const [debouncedTeamPoliciesSearchTerm, setDebouncedTeamPoliciesSearchTerm] = useState('');

  const teamPoliciesDataLoader = useDataLoader((search: string, pagination: ApiPaginationRequestOptions) =>
    biohubApi.teamPolicies.getTeamPolicies({ search }, pagination)
  );

  useEffect(() => {
    const apiPagination = toApiPagination(teamPoliciesPaginationModel, teamPoliciesSortModel);
    teamPoliciesDataLoader.load(debouncedTeamPoliciesSearchTerm, apiPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debouncedTeamPoliciesRefresh = useDebounce((searchTerm: string) => {
    setDebouncedTeamPoliciesSearchTerm(searchTerm);
    const resetPaginationModel = { ...teamPoliciesPaginationModel, page: 0 };
    setTeamPoliciesPaginationModel(resetPaginationModel);
    const apiPagination = toApiPagination(resetPaginationModel, teamPoliciesSortModel);
    teamPoliciesDataLoader.refresh(searchTerm, apiPagination);
  }, 300);

  const handleTeamPoliciesPaginationChange = useCallback(
    (model: GridPaginationModel) => {
      setTeamPoliciesPaginationModel(model);
      const apiPagination = toApiPagination(model, teamPoliciesSortModel);
      teamPoliciesDataLoader.refresh(debouncedTeamPoliciesSearchTerm, apiPagination);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamPoliciesSortModel, debouncedTeamPoliciesSearchTerm]
  );

  const handleTeamPoliciesSortChange = useCallback(
    (model: GridSortModel) => {
      setTeamPoliciesSortModel(model);
      const apiPagination = toApiPagination(teamPoliciesPaginationModel, model);
      teamPoliciesDataLoader.refresh(debouncedTeamPoliciesSearchTerm, apiPagination);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamPoliciesPaginationModel, debouncedTeamPoliciesSearchTerm]
  );

  const refreshTeamPolicies = useCallback(() => {
    const apiPagination = toApiPagination(teamPoliciesPaginationModel, teamPoliciesSortModel);
    teamPoliciesDataLoader.refresh(debouncedTeamPoliciesSearchTerm, apiPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamPoliciesPaginationModel, teamPoliciesSortModel, debouncedTeamPoliciesSearchTerm]);

  const handleTeamPoliciesSearch = useCallback(
    (searchTerm: string) => {
      setTeamPoliciesSearchTerm(searchTerm);
      debouncedTeamPoliciesRefresh(searchTerm);
    },
    [debouncedTeamPoliciesRefresh]
  );

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
          />
        </Container>

        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <TeamPoliciesContainer
            teamPolicies={teamPoliciesDataLoader.data?.team_policies ?? []}
            rowCount={teamPoliciesDataLoader.data?.pagination.total ?? 0}
            paginationModel={teamPoliciesPaginationModel}
            setPaginationModel={handleTeamPoliciesPaginationChange}
            sortModel={teamPoliciesSortModel}
            setSortModel={handleTeamPoliciesSortChange}
            refresh={refreshTeamPolicies}
            searchTerm={teamPoliciesSearchTerm}
            onSearch={handleTeamPoliciesSearch}
          />
        </Container>
      </Box>
    </>
  );
};
