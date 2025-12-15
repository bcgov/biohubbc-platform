import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { debounce } from 'lodash-es';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

  // Data loaders
  const policiesDataLoader = useDataLoader((search?: string) =>
    biohubApi.policies.getPolicies({ search: search || undefined })
  );

  const teamsDataLoader = useDataLoader((search?: string) => biohubApi.teams.getTeams({ search: search || undefined }));

  const teamPoliciesDataLoader = useDataLoader(() => biohubApi.teamPolicies.getTeamPolicies());

  // Load data on mount
  useEffect(() => {
    policiesDataLoader.load(debouncedPolicySearchTerm);
    teamsDataLoader.load(debouncedTeamSearchTerm);
    teamPoliciesDataLoader.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      debounce((term: string) => {
        setDebouncedPolicySearchTerm(term);
        policiesDataLoader.refresh(term);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const debouncedTeamRefresh = useMemo(
    () =>
      debounce((term: string) => {
        setDebouncedTeamSearchTerm(term);
        teamsDataLoader.refresh(term);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handlePolicySearch = useCallback(
    (term: string) => {
      setPolicySearchTerm(term);
      debouncedPolicyRefresh(term);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleTeamSearch = useCallback(
    (term: string) => {
      setTeamSearchTerm(term);
      debouncedTeamRefresh(term);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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
    policiesDataLoader.refresh(debouncedPolicySearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPolicySearchTerm]);

  const refreshTeams = useCallback(() => {
    teamsDataLoader.refresh(debouncedTeamSearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTeamSearchTerm]);

  const refreshTeamPolicies = useCallback(() => {
    teamPoliciesDataLoader.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box py={7}>
      <ActivePoliciesList
        policies={policies}
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
            selectedTeam={selectedTeam}
            selectedPolicy={selectedPolicy}
            refresh={refreshTeamPolicies}
          />
        </Paper>
      </Container>
    </Box>
  );
};
