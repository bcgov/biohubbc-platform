import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TicketSidebarItem } from 'features/admin/tickets/detail/sidebar/TicketSidebarItem';
import { TicketSidebarSection } from 'features/admin/tickets/detail/sidebar/TicketSidebarSection';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { useEffect } from 'react';

interface IPortalTicketSidebarProps {
  teamId?: string;
}

/**
 * Read-only ticket sidebar for portal users showing assignees.
 *
 * @param {IPortalTicketSidebarProps} props
 * @return {*}
 */
export const PortalTicketSidebar = (props: IPortalTicketSidebarProps) => {
  const { teamId } = props;
  const api = useApi();

  const teamMembersLoader = useDataLoader((currentTeamId: string) => api.teams.getTeamMembers(currentTeamId));

  useEffect(() => {
    if (!teamId) {
      return;
    }

    teamMembersLoader.load(teamId);
  }, [teamId, teamMembersLoader]);

  const members: ITeamMember[] = teamMembersLoader.data?.members ?? [];

  return (
    <Stack spacing={5}>
      <TicketSidebarSection label="Assignees">
        <LoadingGuard
          isLoading={teamMembersLoader.isLoading}
          isLoadingFallback={
            <Stack spacing={1}>
              <Skeleton variant="text" width="75%" />
              <Skeleton variant="text" width="60%" />
            </Stack>
          }
          hasNoData={!members.length}
          hasNoDataFallback={<Typography variant="body2">No assignees</Typography>}>
          <Stack spacing={0.75}>
            {members.map((member) => (
              <TicketSidebarItem key={member.team_member_id} label={member.user_identifier} />
            ))}
          </Stack>
        </LoadingGuard>
      </TicketSidebarSection>
    </Stack>
  );
};
