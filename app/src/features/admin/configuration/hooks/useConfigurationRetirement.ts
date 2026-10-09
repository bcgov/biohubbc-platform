import { useState } from 'react';
import { useDialogContext } from 'hooks/useContext';

interface ConfigurationRecord {
  name: string;
  record_end_date?: string | null;
}

interface ConfigurationRetirementOptions<T> {
  label: string;
  retire: (record: T) => Promise<unknown>;
  refresh: () => Promise<void>;
}

/**
 * Confirm retirement of a reusable definition and report the confirmed result.
 *
 * @param options Definition label, mutation, and cache refresh owned by the caller.
 * @returns Retirement handler, pending state, and dismissible error.
 */
export const useConfigurationRetirement = <T extends ConfigurationRecord>({
  label,
  retire,
  refresh
}: ConfigurationRetirementOptions<T>) => {
  const dialogs = useDialogContext();
  const [isRetiring, setIsRetiring] = useState(false);
  const [error, setError] = useState('');

  /**
   * Confirm retirement while retaining the definition for historical reads.
   *
   * @param record Definition selected by the administrator.
   */
  const confirmRetire = (record: T) => {
    if (record.record_end_date) {
      dialogs.setSnackbar({ open: true, snackbarMessage: `This ${label} is already retired` });
      return;
    }
    const close = () => dialogs.setYesNoDialog({ open: false });
    dialogs.setYesNoDialog({
      open: true,
      dialogTitle: `Retire ${label}?`,
      dialogContent: `This record will remain visible as Retired and will no longer be available for new assignments. (${record.name})`,
      yesButtonLabel: 'Retire',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: close,
      onNo: close,
      onYes: async () => {
        close();
        setIsRetiring(true);
        setError('');
        try {
          await retire(record);
          await refresh();
          dialogs.setSnackbar({ open: true, snackbarMessage: 'Retired successfully' });
        } catch (error_) {
          setError((error_ as Error).message);
        } finally {
          setIsRetiring(false);
        }
      }
    });
  };

  return { confirmRetire, isRetiring, error, clearError: () => setError('') };
};
