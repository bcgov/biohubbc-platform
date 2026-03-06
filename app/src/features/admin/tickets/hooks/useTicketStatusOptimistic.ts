import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketWithHistory, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useCallback } from 'react';
import { useTicketStatus } from './useTicketStatus';

interface IUseTicketStatusOptimisticProps {
  ticket: ITicketWithHistory;
  userIdentifier?: string;
}

interface IOptimisticStatusResult {
  previousTicket: ITicketWithHistory;
  optimisticTicket: ITicketWithHistory;
}

export const useTicketStatusOptimistic = ({ ticket, userIdentifier }: IUseTicketStatusOptimisticProps) => {
  const dialogContext = useDialogContext();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const { isSavingStatus, handleUpdateStatus } = useTicketStatus({ ticketId });

  const closeConfirmationDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  const buildOptimisticTicket = useCallback(
    (nextStatus: TicketStatus): IOptimisticStatusResult => {
      const previousTicket = ticketDataLoader.data ?? ticket;

      const optimisticTicket: ITicketWithHistory = {
        ...previousTicket,
        status: nextStatus,
        statuses: buildOptimisticStatuses(previousTicket, nextStatus, userIdentifier)
      };

      return {
        previousTicket,
        optimisticTicket
      };
    },
    [ticket, ticketDataLoader.data, userIdentifier]
  );

  const handleStatusUpdateSuccess = useCallback(
    (optimisticTicket: ITicketWithHistory, updatedTicketStatus: TicketStatus) => {
      ticketDataLoader.setData({
        ...optimisticTicket,
        status: updatedTicketStatus
      });
    },
    [ticketDataLoader]
  );

  const handleStatusUpdateRollback = useCallback(
    (previousTicket: ITicketWithHistory) => {
      ticketDataLoader.setData(previousTicket);
    },
    [ticketDataLoader]
  );

  const updateStatus = useCallback(
    (nextStatus: TicketStatus) => {
      closeConfirmationDialog();

      const { previousTicket, optimisticTicket } = buildOptimisticTicket(nextStatus);
      ticketDataLoader.setData(optimisticTicket);

      handleUpdateStatus(nextStatus, {
        onSuccess: (updatedTicket) => {
          handleStatusUpdateSuccess(optimisticTicket, updatedTicket.status);
        },
        onErrorRollback: () => {
          handleStatusUpdateRollback(previousTicket);
        }
      });
    },
    [
      buildOptimisticTicket,
      closeConfirmationDialog,
      handleStatusUpdateRollback,
      handleStatusUpdateSuccess,
      handleUpdateStatus,
      ticketDataLoader
    ]
  );

  const requestStatusChange = useCallback(
    (nextStatus: TicketStatus) => {
      dialogContext.setYesNoDialog(buildStatusChangeDialogConfig(nextStatus, closeConfirmationDialog, updateStatus));
    },
    [closeConfirmationDialog, dialogContext, updateStatus]
  );

  return {
    isSavingStatus,
    requestStatusChange
  };
};

const buildOptimisticStatuses = (ticket: ITicketWithHistory, nextStatus: TicketStatus, userIdentifier?: string) => {
  if (!userIdentifier) {
    return ticket.statuses;
  }

  return [
    ...ticket.statuses,
    {
      ticket_status_history_id: `optimistic-status-${Date.now()}`,
      ticket_id: ticket.ticket_id,
      user_identifier: userIdentifier,
      create_date: new Date().toISOString(),
      status: nextStatus
    }
  ];
};

const buildStatusChangeDialogConfig = (
  nextStatus: TicketStatus,
  closeConfirmationDialog: () => void,
  updateStatus: (nextStatus: TicketStatus) => void
) => {
  const isClosing = nextStatus === 'closed';

  return {
    open: true,
    dialogTitle: isClosing ? 'Close Ticket' : 'Reopen Ticket',
    dialogText: isClosing
      ? 'Are you sure you want to close this ticket?'
      : 'Are you sure you want to reopen this ticket?',
    onClose: closeConfirmationDialog,
    onNo: closeConfirmationDialog,
    onYes: () => updateStatus(nextStatus)
  };
};
