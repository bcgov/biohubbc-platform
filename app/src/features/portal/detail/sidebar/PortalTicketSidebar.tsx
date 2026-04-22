import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TicketSidebarItem } from 'features/admin/tickets/detail/sidebar/TicketSidebarItem';
import { TicketSidebarSection } from 'features/admin/tickets/detail/sidebar/TicketSidebarSection';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { ITicketAssignee } from 'interfaces/useTicketsApi.interface';
import { useEffect } from 'react';

interface IPortalTicketSidebarProps {
  teamId?: string;
  assignees?: ITicketAssignee[];
}

/**
 * Read-only ticket sidebar for portal users showing assignees.
 *
 * @param {IPortalTicketSidebarProps} props
 * @return {*}
 */
export const PortalTicketSidebar = (props: IPortalTicketSidebarProps) => {
  const { teamId, assignees } = props;
  const api = useApi();

  const teamMembersLoader = useDataLoader((currentTeamId: string) => api.teams.getTeamMembers(currentTeamId));

  useEffect(() => {
    if (!teamId) {
      return;
    }

    teamMembersLoader.load(teamId);
  }, [teamId, teamMembersLoader]);

  const members: ITeamMember[] = teamMembersLoader.data?.members ?? [];
  const assigneeStatusLabel = (status: ITicketAssignee['status']) => status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Stack spacing={5}>
      <TicketSidebarSection label="Assignees">
        <LoadingGuard
          hasNoData={!(assignees ?? []).length}
          hasNoDataFallback={<Typography variant="body2">No assignees</Typography>}>
          <Stack spacing={0.75}>
            {(assignees ?? []).map((assignee) => (
              <TicketSidebarItem
                key={assignee.ticket_system_user_id}
                label={`${assignee.system_user.display_name ?? assignee.system_user.user_identifier} (${assigneeStatusLabel(
                  assignee.status
                )})`}
              />
            ))}
          </Stack>
        </LoadingGuard>
      </TicketSidebarSection>
      <TicketSidebarSection label="Participants">
        <LoadingGuard
          isLoading={teamMembersLoader.isLoading}
          isLoadingFallback={
            <Stack spacing={1}>
              <Skeleton variant="text" width="75%" />
              <Skeleton variant="text" width="60%" />
            </Stack>
          }
          hasNoData={!members.length}
          hasNoDataFallback={<Typography variant="body2">No participants</Typography>}>
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
