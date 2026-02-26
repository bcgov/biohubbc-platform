import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { TicketSidebarSection } from './TicketSidebarSection';
import { TicketSidebarTeam } from './TicketSidebarTeam';

interface ITicketSidebarProps {
  isLoading: boolean;
  team?: ITeamWithMembers;
  onAddTeam?: () => void;
}

/**
 * Renders the team sidebar for ticket context.
 *
 * @param {ITicketSidebarProps} props
 * @return {*}
 */
export const TicketSidebar = (props: ITicketSidebarProps) => {
  const { isLoading, team, onAddTeam } = props;

  return (
    <Stack spacing={2}>
      <TicketSidebarTeam isLoading={isLoading} team={team} onAddTeam={onAddTeam} />
      <Divider />
      <TicketSidebarSection label="Data Requests" />
      <Divider />
      <TicketSidebarSection label="Uploads" />
    </Stack>
  );
};
