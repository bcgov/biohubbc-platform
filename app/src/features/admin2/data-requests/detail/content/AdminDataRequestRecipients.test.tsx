import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SYSTEM_ROLE } from 'constants/roles';
import { DialogContextProvider } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminDataRequestRecipients } from './AdminDataRequestRecipients';

vi.mock('hooks/useApi');
vi.mock('hooks/useAuthStateContext');

const mockUseApi = {
  dataRequest: {
    getDataRequestRecipients: vi.fn(),
    deleteDataRequestRecipient: vi.fn()
  }
};

const recipient = {
  system_user_id: 42,
  user_identifier: 'rbiologist',
  display_name: 'Biologist, Robin',
  email: 'robin@example.com'
};

const renderRecipients = (roleNames: string[]) => {
  (useAuthStateContext as Mock).mockReturnValue({ biohubUserWrapper: { roleNames } });

  return render(
    <DialogContextProvider>
      <AdminDataRequestRecipients dataRequestId="request-1" />
    </DialogContextProvider>
  );
};

describe('AdminDataRequestRecipients', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.dataRequest.getDataRequestRecipients.mockResolvedValue({ recipients: [recipient] });
    mockUseApi.dataRequest.deleteDataRequestRecipient.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('removes a recipient only after confirmation, then reloads the list', async () => {
    renderRecipients([SYSTEM_ROLE.SYSTEM_ADMIN]);

    expect(await screen.findByText('Biologist, Robin')).toBeVisible();

    fireEvent.click(screen.getByTestId('custom-menu-icon-Actions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove recipient' }));

    const dialog = await screen.findByRole('dialog');
    expect(mockUseApi.dataRequest.deleteDataRequestRecipient).not.toHaveBeenCalled();

    mockUseApi.dataRequest.getDataRequestRecipients.mockResolvedValue({ recipients: [] });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Recipient' }));

    await waitFor(() => {
      expect(mockUseApi.dataRequest.deleteDataRequestRecipient).toHaveBeenCalledWith('request-1', 42);
    });
    expect(await screen.findByRole('heading', { name: 'Recipients (0)' })).toBeVisible();
  });

  it('keeps the recipient when the confirmation is cancelled', async () => {
    renderRecipients([SYSTEM_ROLE.SYSTEM_ADMIN]);

    expect(await screen.findByText('Biologist, Robin')).toBeVisible();

    fireEvent.click(screen.getByTestId('custom-menu-icon-Actions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove recipient' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(mockUseApi.dataRequest.deleteDataRequestRecipient).not.toHaveBeenCalled();
    expect(screen.getByText('Biologist, Robin')).toBeVisible();
  });

  it('does not offer removal to data administrators', async () => {
    renderRecipients([SYSTEM_ROLE.DATA_ADMINISTRATOR]);

    expect(await screen.findByText('Biologist, Robin')).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('custom-menu-icon-Actions')).not.toBeInTheDocument();
  });
});
