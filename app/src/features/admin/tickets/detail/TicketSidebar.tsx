import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';

interface ITicketSidebarProps {
  isLoading: boolean;
  team?: ITeamWithMembers;
}

/**
 * Renders the team sidebar for ticket context.
 *
 * @param {ITicketSidebarProps} props
 * @return {*}
 */
export const TicketSidebar = (props: ITicketSidebarProps) => {
  const { isLoading, team } = props;

  return (
    <Box
      sx={{
        bgcolor: 'transparent',
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
      <Box sx={{ py: 2.5 }}>
        <Typography component="h3" sx={{ fontWeight: 700 }}>
          Team
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ py: 2.5 }}>
        {isLoading ? (
          <Stack spacing={1}>
            <Skeleton variant="text" width="75%" />
            <Skeleton variant="text" width="60%" />
          </Stack>
        ) : (
          <Stack spacing={0.75}>
            {(team?.members ?? []).map((member) => (
              <Typography key={member.team_member_id} variant="body2">
                {member.user_identifier}
              </Typography>
            ))}
            {!team?.members?.length && (
              <Typography variant="body2">
                No team members
              </Typography>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
};
