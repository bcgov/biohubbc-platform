import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ITeamMember } from 'interfaces/useTeamsApi.interface';
import { TicketSidebarItem } from './TicketSidebarItem';
import { TicketSidebarSection } from './TicketSidebarSection';

interface ITicketSidebarTeamProps {
  members: ITeamMember[];
  isLoading: boolean;
  onOpenDialog: () => void;
  onRemoveAssignee: (teamMemberId: string) => Promise<void> | void;
}

/**
 * Assignee section for the ticket sidebar.
 *
 * @param {ITicketSidebarTeamProps} props
 * @return {*}
 */
export const TicketSidebarTeam = (props: ITicketSidebarTeamProps) => {
  const { members, isLoading, onOpenDialog, onRemoveAssignee } = props;
  const shouldCollapseMembers = members.length > 3;
  const visibleMembers = shouldCollapseMembers ? members.slice(0, 2) : members;
  const remainingMembersCount = members.length - visibleMembers.length;

  return (
    <TicketSidebarSection label="Assignees" onAdd={onOpenDialog}>
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={
          <Stack spacing={1}>
            <Skeleton variant="text" width="75%" />
            <Skeleton variant="text" width="60%" />
          </Stack>
        }
        hasNoData={!members.length}
        hasNoDataFallback={
          <Typography variant="body2" color="textSecondary">
            No assignees
          </Typography>
        }>
        <Stack spacing={0.75}>
          {visibleMembers.map((member) => (
            <TicketSidebarItem
              key={member.team_member_id}
              label={member.user_identifier}
              onRemove={() => onRemoveAssignee(member.team_member_id)}
            />
          ))}
          {shouldCollapseMembers ? (
            <Button
              variant="text"
              size="small"
              onClick={onOpenDialog}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
              + {remainingMembersCount} more
            </Button>
          ) : null}
        </Stack>
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
