import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TicketSidebarItem } from 'features/admin/tickets/detail/sidebar/TicketSidebarItem';
import { TicketSidebarSection } from 'features/admin/tickets/detail/sidebar/TicketSidebarSection';
import { formatRelationship } from 'features/admin/tickets/utils/formatRelationship';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { ITicketReference } from 'interfaces/useTicketsApi.interface';
import { useEffect } from 'react';

interface IPortalTicketSidebarProps {
  teamId?: string;
  references?: ITicketReference[];
  ticketId: string;
}

/**
 * Read-only ticket sidebar for portal users showing assignees and references.
 *
 * @param {IPortalTicketSidebarProps} props
 * @return {*}
 */
export const PortalTicketSidebar = (props: IPortalTicketSidebarProps) => {
  const { teamId, references = [], ticketId } = props;
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

      <TicketSidebarSection label="References">
        <LoadingGuard
          hasNoData={!references.length}
          hasNoDataFallback={<Typography variant="body2">No references</Typography>}>
          <Stack spacing={0.75}>
            {references.map((reference) => {
              const isSourceReference = reference.source_ticket_id === ticketId;
              const relatedTicketSlug = isSourceReference ? reference.target_ticket_slug : reference.source_ticket_slug;
              const relatedTicketSubject = isSourceReference
                ? reference.target_ticket_subject
                : reference.source_ticket_subject;
              const relatedTicketId = isSourceReference ? reference.target_ticket_id : reference.source_ticket_id;

              return (
                <TicketSidebarItem
                  key={reference.ticket_reference_id}
                  label={`${formatRelationship(reference.relationship)} #${relatedTicketSlug}: ${relatedTicketSubject}`}
                  href={`/portal/tickets/${relatedTicketId}`}
                />
              );
            })}
          </Stack>
        </LoadingGuard>
      </TicketSidebarSection>
    </Stack>
  );
};
