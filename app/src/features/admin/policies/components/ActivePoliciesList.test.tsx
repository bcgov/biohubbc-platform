import { useApi } from 'hooks/useApi';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ActivePoliciesList, IActivePoliciesListProps } from './ActivePoliciesList';

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

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockUseApi = {
  policies: {
    createPolicy: vi.fn(),
    updatePolicy: vi.fn(),
    deletePolicy: vi.fn()
  }
};

const defaultProps: IActivePoliciesListProps = {
  policies: [],
  refresh: vi.fn(),
  searchTerm: '',
  onSearch: vi.fn(),
  selectedPolicyId: null,
  onSelectPolicy: vi.fn()
};

const renderContainer = (props: Partial<IActivePoliciesListProps> = {}) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ActivePoliciesList {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('ActivePoliciesList', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows `No Policies` when there are no policies', async () => {
    const { getByText } = renderContainer({ policies: [] });

    await waitFor(() => {
      expect(getByText('No Policies')).toBeVisible();
    });
  });

  it('shows a table row for a policy with all fields having values', async () => {
    const mockPolicies: IPolicy[] = [
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
    ];

    const { getByText } = renderContainer({ policies: mockPolicies });

    await waitFor(() => {
      expect(getByText('Test Policy')).toBeVisible();
      expect(getByText('Test description')).toBeVisible();
      expect(getByText('allow: urn:*:*:*')).toBeVisible();
    });
  });

  it('shows a table row for a policy with fields not having values', async () => {
    const mockPolicies: IPolicy[] = [
      {
        policy_id: '1',
        name: 'Empty Policy',
        description: null,
        statements: []
      }
    ];

    const { getAllByText } = renderContainer({ policies: mockPolicies });

    await waitFor(() => {
      const dashes = getAllByText('-');
      expect(dashes.length).toBe(2);
    });
  });

  it('renders the add new policy button correctly', async () => {
    const { getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('add-policy-button')).toBeVisible();
    });
  });

  describe('Row Selection', () => {
    it('highlights selected row when selectedPolicyId is provided', async () => {
      const mockPolicies: IPolicy[] = [
        {
          policy_id: 'policy-1',
          name: 'Test Policy',
          description: 'Test description',
          statements: []
        }
      ];

      const { getByText } = renderContainer({
        policies: mockPolicies,
        selectedPolicyId: 'policy-1'
      });

      await waitFor(() => {
        expect(getByText('Test Policy')).toBeVisible();
      });

      // The row should have the selected class (MUI DataGrid applies Mui-selected)
      const row = getByText('Test Policy').closest('.MuiDataGrid-row');
      expect(row).toHaveClass('Mui-selected');
    });
  });
});
