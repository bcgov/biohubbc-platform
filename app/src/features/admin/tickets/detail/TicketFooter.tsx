import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useTicketContext } from 'hooks/useContext';
import { useTicketStatus } from '../hooks/useTicketStatus';
import { TicketStatus } from 'interfaces/useTicketsApi.interface';

interface ITicketFooterProps {
  isSavingComment: boolean;
  status?: TicketStatus;
}

/**
 * Renders footer actions for ticket status and commenting.
 *
 * @param {ITicketFooterProps} props
 * @return {*}
 */
export const TicketFooter = (props: ITicketFooterProps) => {
  const { isSavingComment, status } = props;
  const { ticketId, ticketDataLoader } = useTicketContext();
  const handleRefresh = async () => {
    await ticketDataLoader.refresh(ticketId);
  };
  const { isSavingStatus, handleUpdateStatus } = useTicketStatus({
    ticketId,
    onRefreshTicket: handleRefresh
  });

  return (
    <Stack direction="row" justifyContent="flex-end" spacing={2} alignItems="center">
      {status === 'open' ? (
        <Button
          color="error"
          variant="outlined"
          size="small"
          onClick={() => handleUpdateStatus('closed')}
          disabled={isSavingStatus || isSavingComment}
          data-testid="close-ticket-button">
          Close Ticket
        </Button>
      ) : (
        <Button
          color={status === 'closed' ? 'primary' : 'error'}
          variant="outlined"
          size="small"
          onClick={() => handleUpdateStatus('open')}
          disabled={isSavingStatus || isSavingComment}
          data-testid="open-ticket-button">
          Reopen Ticket
        </Button>
      )}
    </Stack>
  );
};
