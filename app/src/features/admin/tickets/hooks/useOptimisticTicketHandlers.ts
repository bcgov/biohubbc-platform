import { useDialogContext } from 'hooks/useContext';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ITicketExtended, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useCallback } from 'react';
import { useUpdateTicketStatusMutation } from './useUpdateTicketStatusMutation';

interface IUseOptimisticTicketHandlersProps {
  ticket: ITicketExtended;
}

/**
 * Builds the confirmation dialog for closing or reopening a ticket.
 *
 * @param {TicketStatus} nextStatus The status the ticket moves to.
 * @param {() => void} closeConfirmationDialog Closes the dialog.
 * @param {() => void} onConfirm Applies the change.
 * @returns The yes/no dialog configuration.
 */
const buildStatusChangeDialogConfig = (
  nextStatus: TicketStatus,
  closeConfirmationDialog: () => void,
  onConfirm: () => void
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
    onYes: onConfirm
  };
};

/**
 * Close and reopen handlers for the ticket detail header, confirmed through the shared dialog and applied
 * optimistically.
 *
 * @param {IUseOptimisticTicketHandlersProps} props The ticket as cached.
 * @return {*} Whether a status change is saving, and the handler that requests one.
 */
export const useOptimisticTicketHandlers = (props: IUseOptimisticTicketHandlersProps) => {
  const { ticket } = props;
  const dialogContext = useDialogContext();
  const updateStatusMutation = useUpdateTicketStatusMutation();
  const { mutate: updateStatus } = updateStatusMutation;

  /**
   * Closes the open/closed status confirmation dialog.
   *
   * @return {void}
   */
  const closeConfirmationDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  /**
   * Opens the confirmation dialog for closing/reopening the ticket, refusing to close one with unaddressed data
   * requests.
   *
   * @param {TicketStatus} nextStatus The status to move the ticket to.
   * @param {string | undefined} userIdentifier Shown as the author of the timeline entry.
   * @return {void}
   */
  const requestStatusChange = useCallback(
    (nextStatus: TicketStatus, userIdentifier: string | undefined) => {
      const hasUnaddressedDataRequests = ticket.data_requests.some(
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
        buildStatusChangeDialogConfig(nextStatus, closeConfirmationDialog, () => {
          closeConfirmationDialog();
          updateStatus({ status: nextStatus, userIdentifier });
        })
      );
    },
    [closeConfirmationDialog, dialogContext, ticket.data_requests, updateStatus]
  );

  return {
    isSavingStatus: updateStatusMutation.isPending,
    requestStatusChange
  };
};
