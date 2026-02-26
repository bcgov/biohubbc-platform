import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
import { TicketSidebarSection } from './TicketSidebarSection';

interface ITicketSidebarTeamProps {
  teamId?: string;
  onAddTeam?: () => void;
}

/**
 * Team section for the ticket sidebar.
 *
 * @param {ITicketSidebarTeamProps} props
 * @return {*}
 */
export const TicketSidebarTeam = (props: ITicketSidebarTeamProps) => {
  const { teamId, onAddTeam } = props;
  const api = useApi();
  const teamLoader = useDataLoader((currentTeamId: string) => api.teams.getTeam(currentTeamId));

  useEffect(() => {
    if (!teamId) {
      return;
    }

    teamLoader.load(teamId);
  }, [teamId, teamLoader]);

  const team = teamId ? teamLoader.data : undefined;

  return (
    <TicketSidebarSection label="Members" onAdd={onAddTeam}>
      <LoadingGuard
        isLoading={teamLoader.isLoading}
        isLoadingFallback={
          <Stack spacing={1}>
            <Skeleton variant="text" width="75%" />
            <Skeleton variant="text" width="60%" />
          </Stack>
        }>
        <Stack spacing={0.75}>
          {(team?.members ?? []).map((member) => (
            <Typography key={member.team_member_id} variant="body2">
              {member.user_identifier}
            </Typography>
          ))}
          {!team?.members?.length && <Typography variant="body2">No members</Typography>}
        </Stack>
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
