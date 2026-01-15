import { useApi } from 'hooks/useApi';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, fireEvent, render, waitFor } from 'test-helpers/test-utils';
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
  rowCount: 0,
  paginationModel: { page: 0, pageSize: 50 },
  setPaginationModel: vi.fn(),
  sortModel: [{ field: 'name', sort: 'asc' }],
  setSortModel: vi.fn(),
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
        rowCount: 1,
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

  describe('Server Pagination', () => {
    const mockPolicies: IPolicy[] = [
      { policy_id: '1', name: 'Alpha Policy', description: 'First', statements: [] },
      { policy_id: '2', name: 'Beta Policy', description: 'Second', statements: [] }
    ];

    it('displays rowCount in header for server-side pagination', async () => {
      // rowCount prop controls the total displayed, not the array length
      const { getByText } = renderContainer({ policies: mockPolicies, rowCount: 100 });

      await waitFor(() => {
        // Header should show rowCount (100), not policies.length (2)
        expect(getByText('(100)')).toBeVisible();
      });
    });

    it('calls setPaginationModel when page size changes', async () => {
      const mockSetPaginationModel = vi.fn();
      const { getByRole } = renderContainer({
        policies: mockPolicies,
        rowCount: 2,
        setPaginationModel: mockSetPaginationModel
      });

      await waitFor(() => {
        // Find the page size selector (combobox)
        const pageSizeSelector = getByRole('combobox');
        expect(pageSizeSelector).toBeVisible();
      });

      // Change page size
      const pageSizeSelector = getByRole('combobox');
      fireEvent.mouseDown(pageSizeSelector);

      await waitFor(() => {
        const option100 = getByRole('option', { name: '100' });
        fireEvent.click(option100);
      });

      expect(mockSetPaginationModel).toHaveBeenCalled();
    });

    it('calls setSortModel when column header is clicked', async () => {
      const mockSetSortModel = vi.fn();
      const { getByText } = renderContainer({
        policies: mockPolicies,
        rowCount: 2,
        setSortModel: mockSetSortModel
      });

      await waitFor(() => {
        expect(getByText('Alpha Policy')).toBeVisible();
      });

      // Click on the Name column header to trigger sort
      const nameHeader = getByText('Name');
      fireEvent.click(nameHeader);

      expect(mockSetSortModel).toHaveBeenCalled();
    });
  });
});
