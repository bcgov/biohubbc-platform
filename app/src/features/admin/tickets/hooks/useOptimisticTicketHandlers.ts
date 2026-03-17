import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicket, ITicketWithHistory, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useCallback, useState } from 'react';

interface IUseOptimisticTicketHandlersProps {
  ticket: ITicketWithHistory;
  userIdentifier?: string;
}

interface IHandleOptimisticTicketUpdateOptions {
  buildOptimisticTicket: (currentTicket: ITicketWithHistory) => ITicketWithHistory;
  handleUpdate: () => Promise<ITicket>;
  onCommit: (optimisticTicket: ITicketWithHistory, updatedTicket: ITicket) => void;
}

/**
 * Optimistic mutation handlers for ticket detail updates (status + generic ticket update mutations).
 *
 * @param {IUseOptimisticTicketHandlersProps} props
 * @return {*}
 */
export const useOptimisticTicketHandlers = (props: IUseOptimisticTicketHandlersProps) => {
  const { ticket, userIdentifier } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const getCurrentTicket = useCallback(() => ticketDataLoader.data ?? ticket, [ticket, ticketDataLoader.data]);

  const applyOptimisticUpdate = useCallback(
    (buildNextTicket: (current: ITicketWithHistory) => ITicketWithHistory) => {
      const previousTicket = getCurrentTicket();
      const optimisticTicket = buildNextTicket(previousTicket);
      ticketDataLoader.setData(optimisticTicket);

      return { previousTicket, optimisticTicket };
    },
    [getCurrentTicket, ticketDataLoader]
  );

  const commitOptimisticUpdate = useCallback(
    (optimisticTicket: ITicketWithHistory, updatedTicket: ITicket) => {
      ticketDataLoader.setData({
        ...optimisticTicket,
        ...updatedTicket,
        statuses: optimisticTicket.statuses,
        comments: optimisticTicket.comments,
        references: optimisticTicket.references
      });
    },
    [ticketDataLoader]
  );

  const rollbackOptimisticUpdate = useCallback(
    (previousTicket: ITicketWithHistory) => {
      ticketDataLoader.setData(previousTicket);
    },
    [ticketDataLoader]
  );

  /**
   * Closes the open/closed status confirmation dialog.
   *
   * @return {*}
   */
  const closeConfirmationDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  /**
   * Runs a generic ticket mutation with shared optimistic apply/commit/rollback handling.
   *
   * @param {IHandleOptimisticTicketUpdateOptions} options
   * @return {*}
   */
  const handleOptimisticTicketUpdate = useCallback(
    async (options: IHandleOptimisticTicketUpdateOptions) => {
      const { buildOptimisticTicket, handleUpdate, onCommit } = options;
      const { previousTicket, optimisticTicket } = applyOptimisticUpdate(buildOptimisticTicket);

      try {
        const updatedTicket = await handleUpdate();
        onCommit(optimisticTicket, updatedTicket);

        return updatedTicket;
      } catch (error) {
        rollbackOptimisticUpdate(previousTicket);
        throw error;
      }
    },
    [applyOptimisticUpdate, rollbackOptimisticUpdate]
  );

  /**
   * Default optimistic commit strategy that preserves timeline/comments/references from optimistic state.
   *
   * @param {ITicketWithHistory} optimisticTicket
   * @param {ITicket} updatedTicket
   * @return {*}
   */
  const handleCommitOptimisticUpdate = useCallback(
    (optimisticTicket: ITicketWithHistory, updatedTicket: ITicket) => {
      commitOptimisticUpdate(optimisticTicket, updatedTicket);
    },
    [commitOptimisticUpdate]
  );

  /**
   * Applies an optimistic status transition, persists it, and reconciles or rolls back.
   *
   * @param {TicketStatus} nextStatus
   * @return {*}
   */
  const updateStatus = useCallback(
    async (nextStatus: TicketStatus) => {
      closeConfirmationDialog();

      const { previousTicket, optimisticTicket } = applyOptimisticUpdate((currentTicket) => ({
        ...currentTicket,
        status: nextStatus,
        statuses: buildOptimisticStatuses(currentTicket, nextStatus, userIdentifier)
      }));

      try {
        setIsSavingStatus(true);
        const updatedTicket = await api.tickets.updateTicketStatus(ticketId, nextStatus);
        commitOptimisticUpdate(optimisticTicket, updatedTicket);
      } catch (error) {
        rollbackOptimisticUpdate(previousTicket);
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: (error as Error).message
        });
      } finally {
        setIsSavingStatus(false);
      }
    },
    [
      api.tickets,
      applyOptimisticUpdate,
      closeConfirmationDialog,
      commitOptimisticUpdate,
      dialogContext,
      rollbackOptimisticUpdate,
      ticketId,
      userIdentifier
    ]
  );

  /**
   * Opens the confirmation dialog for closing/reopening the ticket.
   *
   * @param {TicketStatus} nextStatus
   * @return {*}
   */
  const requestStatusChange = useCallback(
    (nextStatus: TicketStatus) => {
      dialogContext.setYesNoDialog(buildStatusChangeDialogConfig(nextStatus, closeConfirmationDialog, updateStatus));
    },
    [closeConfirmationDialog, dialogContext, updateStatus]
  );

  return {
    isSavingStatus,
    requestStatusChange,
    handleCommitOptimisticUpdate,
    handleOptimisticTicketUpdate
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
