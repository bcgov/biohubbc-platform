import userEvent from '@testing-library/user-event';
import { DialogContext, IDialogContext, defaultSnackbarProps } from 'contexts/dialogContext';
import { render } from 'test-helpers/test-utils';
import { PageHeader } from './PageHeader';

const renderHeader = (description: string, dialogContext?: Partial<IDialogContext>) =>
  render(
    <DialogContext.Provider
      value={{
        setYesNoDialog: vi.fn(),
        yesNoDialogProps: {
          dialogTitle: '',
          dialogText: '',
          open: false,
          onClose: vi.fn(),
          onNo: vi.fn(),
          onYes: vi.fn()
        },
        setErrorDialog: vi.fn(),
        errorDialogProps: {
          dialogTitle: '',
          dialogText: '',
          open: false,
          onClose: vi.fn(),
          onOk: vi.fn()
        },
        setOkDialog: vi.fn(),
        okDialogProps: {
          dialogTitle: '',
          dialogText: '',
          open: false,
          onClose: vi.fn()
        },
        setSnackbar: vi.fn(),
        snackbarProps: defaultSnackbarProps,
        ...dialogContext
      }}>
      <PageHeader label="Header" description={description} descriptionDialogTitle="Full Description" />
    </DialogContext.Provider>
  );

describe('PageHeader', () => {
  it('opens an ok dialog for truncated descriptions', async () => {
    const setOkDialog = vi.fn();
    const user = userEvent.setup();
    const longDescription = 'A'.repeat(301);
    const { getByRole } = renderHeader(longDescription, { setOkDialog });

    expect(getByRole('button', { name: 'read more' })).toBeVisible();

    await user.click(getByRole('button', { name: 'read more' }));

    expect(setOkDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Full Description',
        dialogText: '',
        dialogContent: expect.anything()
      })
    );
  });
});
