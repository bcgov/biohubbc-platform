import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TicketSidebarItem } from 'features/admin/tickets/detail/sidebar/TicketSidebarItem';
import { TicketSidebarSection } from 'features/admin/tickets/detail/sidebar/TicketSidebarSection';
import { useApi } from 'hooks/useApi';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { ITicketSystemUser } from 'interfaces/useTicketsApi.interface';
import { teamQueryKeys } from 'utils/query-keys/team-query-keys';
import { getUserLabel } from 'utils/Utils';

interface IPortalTicketSidebarProps {
  teamId: string;
  ticketSystemUsers: ITicketSystemUser[];
}

/**
 * Read-only ticket sidebar for portal users showing ticket system users.
 *
 * @param {IPortalTicketSidebarProps} props
 * @return {*}
 */
export const PortalTicketSidebar = (props: IPortalTicketSidebarProps) => {
  const { teamId, ticketSystemUsers } = props;
  const api = useApi();

  const teamMembersQuery = useQuery({
    queryKey: teamQueryKeys.members(teamId),
    queryFn: ({ signal }) => api.teams.getTeamMembers(teamId, { signal })
  });

  const members: ITeamMember[] = teamMembersQuery.data?.members ?? [];
  const getTicketSystemUserStatusLabel = (status: ITicketSystemUser['status']) =>
    status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Stack spacing={5}>
      <TicketSidebarSection label="System Users">
        <LoadingGuard
          hasNoData={!ticketSystemUsers.length}
          hasNoDataFallback={<Typography variant="body2">No users</Typography>}>
          <Stack spacing={0.75}>
            {ticketSystemUsers.map((ticketSystemUser) => (
              <TicketSidebarItem
                key={ticketSystemUser.ticket_system_user_id}
                label={`${getUserLabel(ticketSystemUser.system_user)} (${getTicketSystemUserStatusLabel(
                  ticketSystemUser.status
                )})`}
              />
            ))}
          </Stack>
        </LoadingGuard>
      </TicketSidebarSection>
      <TicketSidebarSection label="Participants">
        <LoadingGuard
          isLoading={teamMembersQuery.isFetching}
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
              <TicketSidebarItem key={member.team_member_id} label={getUserLabel(member)} />
            ))}
          </Stack>
        </LoadingGuard>
      </TicketSidebarSection>
    </Stack>
  );
};
