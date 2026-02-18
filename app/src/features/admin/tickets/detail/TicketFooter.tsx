import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { TicketStatus } from 'interfaces/useTicketsApi.interface';

interface ITicketFooterProps {
  comment: string;
  isSaving: boolean;
  status?: TicketStatus;
  onUpdateStatus: (status: TicketStatus) => Promise<void>;
}

/**
 * Renders footer actions for ticket status and commenting.
 *
 * @param {ITicketFooterProps} props
 * @return {*}
 */
export const TicketFooter = (props: ITicketFooterProps) => {
  const { comment, isSaving, status, onUpdateStatus } = props;

  return (
    <Stack direction="row" justifyContent="flex-end" spacing={2} alignItems="center">
      {status === 'OPEN' ? (
        <Button variant="contained" onClick={() => onUpdateStatus('CLOSED')} disabled={isSaving} data-testid="close-ticket-button">
          Close Ticket
        </Button>
      ) : (
        <Button variant="contained" onClick={() => onUpdateStatus('OPEN')} disabled={isSaving} data-testid="open-ticket-button">
          Reopen Ticket
        </Button>
      )}
      <Button variant="text" disabled={!comment.trim()}>
        Comment
      </Button>
    </Stack>
  );
};
