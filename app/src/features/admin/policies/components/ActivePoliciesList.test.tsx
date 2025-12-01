import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import ActivePoliciesList, { IActivePoliciesListProps } from './ActivePoliciesList';

const renderContainer = (props: IActivePoliciesListProps) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ActivePoliciesList {...props} />
    </MemoryRouter>
  );
};

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockUseApi = {
  policies: {
    createPolicy: vi.fn(),
    updatePolicy: vi.fn(),
    deletePolicy: vi.fn()
  }
};

describe('ActivePoliciesList', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows `No Policies` when there are no policies', async () => {
    const mockRefresh = vi.fn();
    const { getByText } = renderContainer({
      policies: [],
      refresh: mockRefresh,
      searchTerm: '',
      onSearch: vi.fn()
    });

    await waitFor(() => {
      expect(getByText('No Policies')).toBeVisible();
    });
  });

  it('shows a table row for a policy with all fields having values', async () => {
    const mockRefresh = vi.fn();

    const { getByText } = renderContainer({
      policies: [
        {
          policy_id: '1',
          name: 'Test Policy',
          description: 'Test description',
          statements: [
            {
              policy_statement_id: 's1',
              policy_id: '1',
              effect: 'allow',
              submission_feature_urn: 'urn:*:*:*',
              conditions: []
            }
          ]
        }
      ],
      refresh: mockRefresh,
      searchTerm: '',
      onSearch: vi.fn()
    });

    await waitFor(() => {
      expect(getByText('Test Policy')).toBeVisible();
      expect(getByText('Test description')).toBeVisible();
      expect(getByText('allow: urn:*:*:*')).toBeVisible();
    });
  });

  it('shows a table row for a policy with fields not having values', async () => {
    const mockRefresh = vi.fn();
    const { getAllByText } = renderContainer({
      policies: [
        {
          policy_id: '1',
          name: 'Empty Policy',
          description: null,
          statements: []
        }
      ],
      refresh: mockRefresh,
      searchTerm: '',
      onSearch: vi.fn()
    });

    await waitFor(() => {
      const dashes = getAllByText('-');
      expect(dashes.length).toBe(2);
    });
  });

  it('renders the add new policy button correctly', async () => {
    const mockRefresh = vi.fn();
    const { getByTestId } = renderContainer({
      policies: [],
      refresh: mockRefresh,
      searchTerm: '',
      onSearch: vi.fn()
    });

    await waitFor(() => {
      expect(getByTestId('add-policy-button')).toBeVisible();
    });
  });
});
