import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

interface ITicketTeamDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Placeholder dialog for future ticket team management functionality.
 *
 * @param {ITicketTeamDialogProps} props
 * @return {*}
 */
export const TicketTeamDialog = (props: ITicketTeamDialogProps) => {
  const { open, onClose } = props;

  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="ticket-team-dialog-title">
      <DialogTitle id="ticket-team-dialog-title">Team</DialogTitle>
      <DialogContent>
        <Typography>placeholder</Typography>
      </DialogContent>
    </Dialog>
  );
};
