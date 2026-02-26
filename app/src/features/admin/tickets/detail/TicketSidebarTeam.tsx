import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { TicketSidebarSection } from './TicketSidebarSection';

interface ITicketSidebarTeamProps {
  isLoading: boolean;
  team?: ITeamWithMembers;
  onAddTeam?: () => void;
}

/**
 * Team section for the ticket sidebar.
 *
 * @param {ITicketSidebarTeamProps} props
 * @return {*}
 */
export const TicketSidebarTeam = (props: ITicketSidebarTeamProps) => {
  const { isLoading, team, onAddTeam } = props;

  return (
    <TicketSidebarSection label="Members" onAdd={onAddTeam}>
      <LoadingGuard
        isLoading={isLoading}
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

