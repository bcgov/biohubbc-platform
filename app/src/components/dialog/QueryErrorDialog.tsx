import { useDialogContext } from 'hooks/useContext';
import { useEffect } from 'react';

interface QueryErrorDialogProps {
  error: Error | null;
  label: string;
}

/**
 * Reports a failed read, including a background refresh, through the shared OkDialog.
 * Dismissing the dialog leaves loaded content usable and does not reopen it for the same error.
 *
 * @param {QueryErrorDialogProps} props The query failure and resource label.
 * @returns {null} The dialog is rendered by the dialog context provider.
 */
export const QueryErrorDialog = ({ error, label }: QueryErrorDialogProps) => {
  const { setOkDialog } = useDialogContext();

  useEffect(() => {
    if (!error) {
      return;
    }

    setOkDialog({
      open: true,
      dialogTitle: `Failed to load ${label}`,
      dialogText: error.message,
      dialogContent: undefined,
      okButtonLabel: 'Ok',
      okButtonProps: undefined,
      dialogProps: { maxWidth: 'sm' },
      onClose: () => setOkDialog({ open: false })
    });
  }, [error, label, setOkDialog]);

  return null;
};
