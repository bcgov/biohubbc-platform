import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useCallback } from 'react';
import { useTicketStatus } from '../../hooks/useTicketStatus';

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
  const dialogContext = useDialogContext();

  const { ticketId, ticketDataLoader } = useTicketContext();

  // Refresh the active ticket details.
  const handleRefresh = async () => {
    await ticketDataLoader.refresh(ticketId);
  };

  const { isSavingStatus, handleUpdateStatus } = useTicketStatus({
    ticketId,
    onRefreshTicket: handleRefresh
  });

  // Close the close-ticket confirmation dialog.
  const closeConfirmationDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  // Execute close/reopen status actions without currying.
  const handleConfirmCloseTicket = useCallback(() => {
    closeConfirmationDialog();
    handleUpdateStatus('closed');
  }, [closeConfirmationDialog, handleUpdateStatus]);

  const handleReopenTicket = useCallback(() => {
    closeConfirmationDialog();
    handleUpdateStatus('open');
  }, [closeConfirmationDialog, handleUpdateStatus]);

  // Open the close-ticket confirmation dialog.
  const handleCloseTicketClick = () => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Close Ticket',
      dialogText: 'Are you sure you want to close this ticket?',
      onClose: closeConfirmationDialog,
      onNo: closeConfirmationDialog,
      onYes: handleConfirmCloseTicket
    });
  };

  return (
    <Stack direction="row" justifyContent="flex-end" spacing={2} alignItems="center">
      {status === 'open' ? (
        <Button
          color="error"
          variant="outlined"
          size="small"
          onClick={handleCloseTicketClick}
          disabled={isSavingStatus || isSavingComment}
          data-testid="close-ticket-button">
          Close Ticket
        </Button>
      ) : (
        <Button
          color={status === 'closed' ? 'primary' : 'error'}
          variant="outlined"
          size="small"
          onClick={handleReopenTicket}
          disabled={isSavingStatus || isSavingComment}
          data-testid="open-ticket-button">
          Reopen Ticket
        </Button>
      )}
    </Stack>
  );
};
