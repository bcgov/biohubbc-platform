import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { IApiKeyView, ICreateApiKeyResponse } from 'interfaces/useApiKeysApi.interface';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PortalApiKeysPage } from './PortalApiKeysPage';

vi.mock('../../hooks/useApi');

const mockUseApi = useApi as Mock;

const makeKeyView = (overrides: Partial<IApiKeyView> = {}): IApiKeyView => ({
  api_key_id: 'aabbccdd-0000-0000-0000-000000000001',
  system_user_id: 1,
  name: 'My script key',
  key_prefix: 'biohub_AbCdEfGh',
  expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  revoked_at: null,
  last_used_at: null,
  record_end_date: null,
  create_date: '2026-05-01T00:00:00.000Z',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  ...overrides
});

const mockListApiKeys = vi.fn();
const mockCreateApiKey = vi.fn();
const mockRevokeApiKey = vi.fn();
const mockDeleteApiKey = vi.fn();

const renderPage = () => render(<PortalApiKeysPage />);

const clickMenuButton = async () => {
  await waitFor(() => screen.getByTestId('custom-menu-icon-Actions'));
  fireEvent.click(screen.getByTestId('custom-menu-icon-Actions'));
};

const clickRevokeFromMenu = async () => {
  await clickMenuButton();
  await waitFor(() => screen.getByTestId('custom-menu-icon-item-Revoke'));
  fireEvent.click(screen.getByTestId('custom-menu-icon-item-Revoke'));
};

const clickDeleteFromMenu = async () => {
  await clickMenuButton();
  await waitFor(() => screen.getByTestId('custom-menu-icon-item-Delete'));
  fireEvent.click(screen.getByTestId('custom-menu-icon-item-Delete'));
};

describe('PortalApiKeysPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      apiKeys: {
        listApiKeys: mockListApiKeys,
        createApiKey: mockCreateApiKey,
        revokeApiKey: mockRevokeApiKey,
        deleteApiKey: mockDeleteApiKey
      }
    });

    mockListApiKeys.mockResolvedValue([]);
  });

  describe('list rendering', () => {
    it('renders empty state message when the user has no keys', async () => {
      mockListApiKeys.mockResolvedValue([]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/No API keys\./i)).toBeInTheDocument();
      });
    });

    it('renders the API keys table', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('portal-api-keys-table')).toBeInTheDocument();
      });
    });

    it('renders key rows in the table when keys exist', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('My script key')).toBeInTheDocument();
        expect(screen.getByText('biohub_AbCdEfGh')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('shows Revoked chip for a revoked key and action menu is still present', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView({ revoked_at: '2026-01-01T00:00:00.000Z' })]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Revoked')).toBeInTheDocument();
        expect(screen.getByTestId('custom-menu-icon-Actions')).toBeInTheDocument();
      });
    });

    it('shows Expired chip for an expired key and action menu is still present', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView({ expires_at: '2020-01-01T00:00:00.000Z' })]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Expired')).toBeInTheDocument();
        expect(screen.getByTestId('custom-menu-icon-Actions')).toBeInTheDocument();
      });
    });

    it('shows only Delete (no Revoke) in the menu for a revoked key', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView({ revoked_at: '2026-01-01T00:00:00.000Z' })]);

      renderPage();

      await clickMenuButton();

      await waitFor(() => {
        expect(screen.queryByTestId('custom-menu-icon-item-Revoke')).not.toBeInTheDocument();
        expect(screen.getByTestId('custom-menu-icon-item-Delete')).toBeInTheDocument();
      });
    });

    it('shows Revoke and Delete in the menu for an active key', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);

      renderPage();

      await clickMenuButton();

      await waitFor(() => {
        expect(screen.getByTestId('custom-menu-icon-item-Revoke')).toBeInTheDocument();
        expect(screen.getByTestId('custom-menu-icon-item-Delete')).toBeInTheDocument();
      });
    });
  });

  describe('create flow', () => {
    it('opens create dialog when New API Key button is clicked', async () => {
      renderPage();

      await waitFor(() => screen.getByTestId('portal-api-keys-add-button'));
      fireEvent.click(screen.getByTestId('portal-api-keys-add-button'));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'New API Key' })).toBeInTheDocument();
    });

    it('shows the plaintext key after successful creation', async () => {
      const response: ICreateApiKeyResponse = {
        api_key: makeKeyView(),
        plaintext_key: 'biohub_AbCdEfGh_supersecretvalue12345678'
      };
      mockCreateApiKey.mockResolvedValue(response);

      renderPage();

      await waitFor(() => screen.getByTestId('portal-api-keys-add-button'));
      fireEvent.click(screen.getByTestId('portal-api-keys-add-button'));

      const nameInput = screen.getByRole('textbox', { name: /key name/i });
      fireEvent.change(nameInput, { target: { value: 'My new key' } });

      fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

      await waitFor(() => {
        expect(screen.getByText(/save this key now/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('biohub_AbCdEfGh_supersecretvalue12345678')).toBeInTheDocument();
      });
    });

    it('does not create an API key when name field is empty', async () => {
      renderPage();

      await waitFor(() => screen.getByTestId('portal-api-keys-add-button'));
      fireEvent.click(screen.getByTestId('portal-api-keys-add-button'));

      fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

      await waitFor(() => {
        expect(mockCreateApiKey).not.toHaveBeenCalled();
        expect(screen.queryByText(/save this key now/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('revoke flow', () => {
    it('shows revoke confirmation dialog when Revoke is clicked', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);

      renderPage();

      await clickRevokeFromMenu();

      await waitFor(() => {
        expect(screen.getByTestId('yes-no-dialog')).toBeInTheDocument();
        expect(screen.getByText(/revoke api key/i)).toBeInTheDocument();
      });
    });

    it('calls revokeApiKey and refreshes the list when confirmed', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);
      mockRevokeApiKey.mockResolvedValue(undefined);

      renderPage();

      await clickRevokeFromMenu();

      await waitFor(() => screen.getByTestId('yes-button'));
      fireEvent.click(screen.getByTestId('yes-button'));

      await waitFor(() => {
        expect(mockRevokeApiKey).toHaveBeenCalledWith('aabbccdd-0000-0000-0000-000000000001');
        expect(mockListApiKeys).toHaveBeenCalledTimes(2);
      });
    });

    it('closes the dialog without revoking when No is clicked', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);

      renderPage();

      await clickRevokeFromMenu();

      await waitFor(() => screen.getByTestId('no-button'));
      fireEvent.click(screen.getByTestId('no-button'));

      await waitFor(() => {
        expect(mockRevokeApiKey).not.toHaveBeenCalled();
        expect(screen.queryByTestId('yes-no-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('delete flow', () => {
    it('shows delete confirmation dialog when Delete is clicked for an active key', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);

      renderPage();

      await clickDeleteFromMenu();

      await waitFor(() => {
        expect(screen.getByTestId('yes-no-dialog')).toBeInTheDocument();
        expect(screen.getByText(/delete api key/i)).toBeInTheDocument();
      });
    });

    it('shows delete confirmation dialog when Delete is clicked for a revoked key', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView({ revoked_at: '2026-01-01T00:00:00.000Z' })]);

      renderPage();

      await clickDeleteFromMenu();

      await waitFor(() => {
        expect(screen.getByTestId('yes-no-dialog')).toBeInTheDocument();
        expect(screen.getByText(/delete api key/i)).toBeInTheDocument();
      });
    });

    it('calls deleteApiKey and refreshes the list when confirmed', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);
      mockDeleteApiKey.mockResolvedValue(undefined);

      renderPage();

      await clickDeleteFromMenu();

      await waitFor(() => screen.getByTestId('yes-button'));
      fireEvent.click(screen.getByTestId('yes-button'));

      await waitFor(() => {
        expect(mockDeleteApiKey).toHaveBeenCalledWith('aabbccdd-0000-0000-0000-000000000001');
        expect(mockListApiKeys).toHaveBeenCalledTimes(2);
      });
    });

    it('closes the dialog without deleting when No is clicked', async () => {
      mockListApiKeys.mockResolvedValue([makeKeyView()]);

      renderPage();

      await clickDeleteFromMenu();

      await waitFor(() => screen.getByTestId('no-button'));
      fireEvent.click(screen.getByTestId('no-button'));

      await waitFor(() => {
        expect(mockDeleteApiKey).not.toHaveBeenCalled();
        expect(screen.queryByTestId('yes-no-dialog')).not.toBeInTheDocument();
      });
    });
  });
});
