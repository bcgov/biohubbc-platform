import { IYesNoDialogProps } from 'components/dialog/YesNoDialog';
import { useDialogContext } from 'hooks/useContext';
import { useCallback } from 'react';

interface ITicketTimelineConfirmationDialogProps extends Pick<
  IYesNoDialogProps,
  'dialogTitle' | 'dialogText' | 'yesButtonLabel' | 'noButtonLabel'
> {
  onConfirm: () => Promise<void> | void;
}

/**
 * Shared confirmation-dialog behavior for ticket timeline actions.
 *
 * @returns Confirmation dialog open handler for timeline mutations.
 */
export const useTicketTimelineConfirmationDialog = () => {
  const dialogContext = useDialogContext();

  /**
   * Close the global yes/no dialog used by timeline confirmation flows.
   *
   * Shared by cancel, close, and confirmed paths so each caller resets the dialog the same way.
   *
   * @returns {void}
   */
  const closeConfirmationDialog = useCallback(() => {
    dialogContext.setYesNoDialog({ open: false });
  }, [dialogContext]);

  /**
   * Open the global yes/no dialog for a ticket timeline mutation.
   *
   * Feature-specific handlers provide the copy and confirmed mutation. This helper owns the repeated close/cancel
   * wiring so timeline action hooks expose focused domain handlers without duplicating dialog boilerplate.
   *
   * @param {ITicketTimelineConfirmationDialogProps} confirmationDialogProps Dialog copy and confirmation callback.
   * @returns {void}
   */
  const openConfirmationDialog = useCallback(
    (confirmationDialogProps: ITicketTimelineConfirmationDialogProps) => {
      const { onConfirm, ...dialogProps } = confirmationDialogProps;

      dialogContext.setYesNoDialog({
        open: true,
        ...dialogProps,
        noButtonLabel: dialogProps.noButtonLabel ?? 'Cancel',
        onClose: closeConfirmationDialog,
        onNo: closeConfirmationDialog,
        onYes: async () => {
          closeConfirmationDialog();
          await onConfirm();
        }
      });
    },
    [closeConfirmationDialog, dialogContext]
  );

  return { openConfirmationDialog };
};
