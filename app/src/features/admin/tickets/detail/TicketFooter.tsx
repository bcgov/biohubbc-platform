import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { TicketStatus } from 'interfaces/useTicketsApi.interface';

interface ITicketFooterProps {
  isSavingStatus: boolean;
  isSavingComment: boolean;
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
  const { isSavingStatus, isSavingComment, status, onUpdateStatus } = props;

  return (
    <Stack direction="row" justifyContent="flex-end" spacing={2} alignItems="center">
      {status === 'open' ? (
        <Button
          color="error"
          variant="outlined"
          size="small"
          onClick={() => onUpdateStatus('closed')}
          disabled={isSavingStatus || isSavingComment}
          data-testid="close-ticket-button">
          Close Ticket
        </Button>
      ) : (
        <Button
          color="error"
          variant="outlined"
          size="small"
          onClick={() => onUpdateStatus('open')}
          disabled={isSavingStatus || isSavingComment}
          data-testid="open-ticket-button">
          Reopen Ticket
        </Button>
      )}
    </Stack>
  );
};
