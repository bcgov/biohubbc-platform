import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TicketSidebarItem } from 'features/admin/tickets/detail/sidebar/TicketSidebarItem';
import { TicketSidebarSection } from 'features/admin/tickets/detail/sidebar/TicketSidebarSection';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { ITicketSystemUser } from 'interfaces/useTicketsApi.interface';
import { useEffect } from 'react';

interface IPortalTicketSidebarProps {
  teamId?: string;
  ticketSystemUsers?: ITicketSystemUser[];
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

  const teamMembersLoader = useDataLoader((currentTeamId: string) => api.teams.getTeamMembers(currentTeamId));

  useEffect(() => {
    if (!teamId) {
      return;
    }

    teamMembersLoader.load(teamId);
  }, [teamId, teamMembersLoader]);

  const members: ITeamMember[] = teamMembersLoader.data?.members ?? [];
  const getTicketSystemUserStatusLabel = (status: ITicketSystemUser['status']) =>
    status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Stack spacing={5}>
      <TicketSidebarSection label="System Users">
        <LoadingGuard
          hasNoData={!(ticketSystemUsers ?? []).length}
          hasNoDataFallback={<Typography variant="body2">No users</Typography>}>
          <Stack spacing={0.75}>
            {(ticketSystemUsers ?? []).map((ticketSystemUser) => (
              <TicketSidebarItem
                key={ticketSystemUser.ticket_system_user_id}
                label={`${
                  ticketSystemUser.system_user.display_name ?? ticketSystemUser.system_user.user_identifier
                } (${getTicketSystemUserStatusLabel(ticketSystemUser.status)})`}
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
