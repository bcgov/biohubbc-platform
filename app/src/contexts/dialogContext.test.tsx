import { act, render } from '@testing-library/react';
import { useDialogContext } from 'hooks/useContext';
import { useEffect } from 'react';
import { DialogContextProvider, IDialogContext } from './dialogContext';

const loadError = new Error('Failed to load');

/**
 * Reports a load error through the error dialog from an effect keyed on the error and the setter, as a dialog
 * reporting a failed query does.
 *
 * @param {{ onRender: (context: IDialogContext) => void; onReport: () => void }} props Observers for each render
 * and each report.
 * @returns {null}
 */
const ErrorReporter = ({
  onRender,
  onReport
}: {
  onRender: (context: IDialogContext) => void;
  onReport: () => void;
}) => {
  const dialogContext = useDialogContext();
  const { setErrorDialog } = dialogContext;
  onRender(dialogContext);

  useEffect(() => {
    onReport();
    setErrorDialog({ open: true, dialogTitle: 'Load failed', dialogText: loadError.message });
  }, [onReport, setErrorDialog]);

  return null;
};

describe('DialogContextProvider', () => {
  it('keeps each setter the same across renders, so an effect keyed on one reports an error once', () => {
    const contexts: IDialogContext[] = [];
    const onRender = (context: IDialogContext) => contexts.push(context);
    const onReport = vi.fn();

    render(
      <DialogContextProvider>
        <ErrorReporter onRender={onRender} onReport={onReport} />
      </DialogContextProvider>
    );

    act(() => {
      contexts.at(-1)?.setSnackbar({ open: true, snackbarMessage: 'Saved' });
      contexts.at(-1)?.setYesNoDialog({ open: true, dialogTitle: 'Confirm' });
      contexts.at(-1)?.setOkDialog({ open: true, dialogTitle: 'Done' });
    });

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(contexts.length).toBeGreaterThan(1);
    const [first] = contexts;
    const last = contexts.at(-1);
    expect(last?.setErrorDialog).toBe(first.setErrorDialog);
    expect(last?.setYesNoDialog).toBe(first.setYesNoDialog);
    expect(last?.setOkDialog).toBe(first.setOkDialog);
    expect(last?.setSnackbar).toBe(first.setSnackbar);
    expect(last?.errorDialogProps.open).toBe(true);
    expect(last?.yesNoDialogProps.dialogTitle).toBe('Confirm');
  });

  it('merges successive calls to one setter made in the same update', () => {
    const contexts: IDialogContext[] = [];

    render(
      <DialogContextProvider>
        <ErrorReporter onRender={(context) => contexts.push(context)} onReport={vi.fn()} />
      </DialogContextProvider>
    );

    act(() => {
      contexts.at(-1)?.setYesNoDialog({ dialogTitle: 'Remove' });
      contexts.at(-1)?.setYesNoDialog({ open: true });
    });

    expect(contexts.at(-1)?.yesNoDialogProps).toMatchObject({ open: true, dialogTitle: 'Remove' });
  });
});
