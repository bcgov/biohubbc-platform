import { cleanup, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ManagePoliciesPage } from './ManagePoliciesPage';

// Mock Monaco Editor - it doesn't work well in jsdom and causes hangs
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value?: string) => void }) => (
    <textarea data-testid="monaco-editor" value={value || ''} onChange={(e) => onChange?.(e.target.value)} />
  ),
  loader: {
    init: vi.fn().mockResolvedValue({
      languages: {
        json: {
          jsonDefaults: {
            setDiagnosticsOptions: vi.fn()
          }
        }
      }
    })
  }
}));

const renderContainer = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ManagePoliciesPage />
    </MemoryRouter>
  );
};

vi.mock('../../../hooks/useApi');

const mockBiohubApi = useApi as Mock;

const mockUseApi = {
  policies: {
    getPolicies: vi.fn()
  }
};

describe('ManagePoliciesPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the main page content correctly', async () => {
    mockUseApi.policies.getPolicies.mockResolvedValue({ policies: [], pagination: { total: 0, page: 1, limit: 10 } });

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('Manage Policies')).toBeVisible();
    });
  });

  it('renders the active policies component', async () => {
    mockUseApi.policies.getPolicies.mockResolvedValue({ policies: [], pagination: { total: 0, page: 1, limit: 10 } });

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('No Policies')).toBeVisible();
    });
  });
});
