import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { TicketTeamDialog } from '../components/dialog/TicketTeamDialog';
import { TicketSidebarSection } from './TicketSidebarSection';
import { TicketSidebarTeam } from './TicketSidebarTeam';

interface ITicketSidebarProps {
  teamId?: string;
}

/**
 * Renders the team sidebar for ticket context.
 *
 * @param {ITicketSidebarProps} props
 * @return {*}
 */
export const TicketSidebar = (props: ITicketSidebarProps) => {
  const { teamId } = props;
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);

  return (
    <>
      <Stack spacing={2}>
        <TicketSidebarTeam teamId={teamId} onAddTeam={() => setIsTeamDialogOpen(true)} />
        <Divider />
        <TicketSidebarSection label="Data Requests" />
        <Divider />
        <TicketSidebarSection label="Uploads" />
      </Stack>
      <TicketTeamDialog open={isTeamDialogOpen} onClose={() => setIsTeamDialogOpen(false)} />
    </>
  );
};
