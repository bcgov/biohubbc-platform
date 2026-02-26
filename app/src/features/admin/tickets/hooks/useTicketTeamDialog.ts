import { useState } from 'react';

/**
 * Team dialog open/close state for ticket details.
 *
 * @return {*}
 */
export const useTicketTeamDialog = () => {
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);

  return {
    isTeamDialogOpen,
    openTeamDialog: () => setIsTeamDialogOpen(true),
    closeTeamDialog: () => setIsTeamDialogOpen(false)
  };
};

