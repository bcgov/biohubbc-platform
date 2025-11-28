import { cleanup, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import ManagePoliciesPage from './ManagePoliciesPage';

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
    mockUseApi.policies.getPolicies.mockReturnValue({ policies: [], pagination: { total: 0, page: 1, limit: 10 } });

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('Manage Policies')).toBeVisible();
    });
  });

  it('renders the active policies component', async () => {
    mockUseApi.policies.getPolicies.mockReturnValue({ policies: [], pagination: { total: 0, page: 1, limit: 10 } });

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('No Policies')).toBeVisible();
    });
  });
});
