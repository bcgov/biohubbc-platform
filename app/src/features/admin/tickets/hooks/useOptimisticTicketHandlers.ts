import { useApi } from 'hooks/useApi';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ITicket, ITicketExtended, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useCallback, useState } from 'react';

interface IHandleOptimisticTicketUpdateOptions {
  buildOptimisticTicket: (currentTicket: ITicketExtended) => ITicketExtended;
  handleUpdate: () => Promise<ITicket>;
}

interface IUseOptimisticTicketHandlersProps {
  ticket: ITicketExtended;
}

/**
 * Optimistic mutation handlers for ticket detail updates (status + generic ticket update mutations).
 *
 * @param {IUseOptimisticTicketHandlersProps} props Hook props.
 * @return {*}
 */
export const useOptimisticTicketHandlers = (props: IUseOptimisticTicketHandlersProps) => {
  const { ticket } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const getCurrentTicket = useCallback(() => ticketDataLoader.data ?? ticket, [ticket, ticketDataLoader.data]);

  const applyOptimisticUpdate = useCallback(
    (buildNextTicket: (current: ITicketExtended) => ITicketExtended) => {
      const previousTicket = getCurrentTicket();
      const optimisticTicket = buildNextTicket(previousTicket);
      ticketDataLoader.setData(optimisticTicket);

      return { previousTicket, optimisticTicket };
    },
    [getCurrentTicket, ticketDataLoader]
  );

  const commitOptimisticUpdate = useCallback(
    (optimisticTicket: ITicketExtended, updatedTicket: ITicket) => {
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
    (previousTicket: ITicketExtended) => {
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
      const { buildOptimisticTicket, handleUpdate } = options;
      const optimisticUpdate = applyOptimisticUpdate(buildOptimisticTicket);
      const { previousTicket, optimisticTicket } = optimisticUpdate;

      try {
        const updatedTicket = await handleUpdate();
        commitOptimisticUpdate(optimisticTicket, updatedTicket);

        return updatedTicket;
      } catch (error) {
        rollbackOptimisticUpdate(previousTicket);
        throw error;
      }
    },
    [applyOptimisticUpdate, commitOptimisticUpdate, rollbackOptimisticUpdate]
  );

  /**
   * Applies an optimistic status transition, persists it, and reconciles or rolls back.
   *
   * @param {TicketStatus} nextStatus
   * @return {*}
   */
  const updateStatus = useCallback(
    async (nextStatus: TicketStatus, userIdentifier: string | undefined) => {
      closeConfirmationDialog();

      const optimisticUpdate = applyOptimisticUpdate((currentTicket) => ({
        ...currentTicket,
        status: nextStatus,
        statuses: buildOptimisticStatuses(currentTicket, nextStatus, userIdentifier)
      }));
      const { previousTicket, optimisticTicket } = optimisticUpdate;

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
      ticketId
    ]
  );

  /**
   * Opens the confirmation dialog for closing/reopening the ticket.
   *
   * @param {TicketStatus} nextStatus
   * @return {*}
   */
  const requestStatusChange = useCallback(
    (nextStatus: TicketStatus, userIdentifier: string | undefined) => {
      const currentTicket = getCurrentTicket();
      const hasUnaddressedDataRequests = currentTicket.data_requests.some(
        (dataRequest) => dataRequest.status === PolicyStatus.REQUESTED || dataRequest.status === PolicyStatus.REVIEWED
      );

      if (nextStatus === 'closed' && hasUnaddressedDataRequests) {
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Cannot close tickets that have unaddressed data requests'
        });
        return;
      }

      dialogContext.setYesNoDialog(
        buildStatusChangeDialogConfig(nextStatus, userIdentifier, closeConfirmationDialog, updateStatus)
      );
    },
    [closeConfirmationDialog, dialogContext, getCurrentTicket, updateStatus]
  );

  return {
    isSavingStatus,
    requestStatusChange,
    handleOptimisticTicketUpdate
  };
};

const buildOptimisticStatuses = (
  ticket: ITicketExtended,
  nextStatus: TicketStatus,
  userIdentifier: string | undefined
) => {
  if (!userIdentifier) {
    return ticket.statuses;
  }

  return [
    ...ticket.statuses,
    {
      ticket_status_id: `optimistic-status-${Date.now()}`,
      ticket_id: ticket.ticket_id,
      user_identifier: userIdentifier,
      create_date: new Date().toISOString(),
      status: nextStatus
    }
  ];
};

const buildStatusChangeDialogConfig = (
  nextStatus: TicketStatus,
  userIdentifier: string | undefined,
  closeConfirmationDialog: () => void,
  updateStatus: (nextStatus: TicketStatus, userIdentifier: string | undefined) => void
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
    onYes: () => updateStatus(nextStatus, userIdentifier)
  };
};
