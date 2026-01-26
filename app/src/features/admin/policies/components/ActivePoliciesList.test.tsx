import { fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ActivePoliciesList, IActivePoliciesListProps } from './ActivePoliciesList';

// Types for DataGrid mock
interface MockDataGridProps {
  rows: IPolicy[];
  localeText?: { noRowsLabel?: string };
}

// Simple DataGrid mock - just renders rows as divs, no behavior simulation
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, localeText }: MockDataGridProps) => (
    <div data-testid="mock-data-grid">
      {rows.length === 0 ? (
        <div>{localeText?.noRowsLabel}</div>
      ) : (
        rows.map((row) => (
          <div key={row.policy_id} data-testid={`row-${row.policy_id}`}>
            {row.name}
          </div>
        ))
      )}
    </div>
  )
}));

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value?: string) => void }) => (
    <textarea data-testid="monaco-editor" value={value || ''} onChange={(e) => onChange?.(e.target.value)} />
  ),
  loader: {
    init: vi.fn().mockResolvedValue({
      languages: { json: { jsonDefaults: { setDiagnosticsOptions: vi.fn() } } }
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
  },
  submissions: {
    getPublishedSubmissionsForAdmins: vi.fn().mockResolvedValue([])
  }
};

const defaultProps: IActivePoliciesListProps = {
  policies: [],
  rowCount: 0,
  paginationModel: { page: 0, pageSize: 10 },
  setPaginationModel: vi.fn(),
  sortModel: [{ field: 'name', sort: 'asc' }],
  setSortModel: vi.fn(),
  refresh: vi.fn(),
  searchTerm: '',
  onSearch: vi.fn(),
  selectedPolicyId: null,
  onSelectPolicy: vi.fn()
};

const renderComponent = (props: Partial<IActivePoliciesListProps> = {}) => {
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
    vi.clearAllMocks();
  });

  describe('Header', () => {
    it('displays rowCount in header', async () => {
      // Step 1: Render with custom rowCount prop
      const { getByText } = renderComponent({ rowCount: 42 });

      // Step 2: Verify dynamic rowCount appears in header
      await waitFor(() => {
        expect(getByText('(42)')).toBeVisible();
      });
    });
  });

  describe('Search', () => {
    it('displays controlled search term value', async () => {
      // Step 1: Render with searchTerm prop set
      const { getByPlaceholderText } = renderComponent({ searchTerm: 'test query' });

      // Step 2: Verify input displays the controlled value
      await waitFor(() => {
        expect(getByPlaceholderText('Search by policy name')).toHaveValue('test query');
      });
    });

    it('calls onSearch when input changes', async () => {
      // Step 1: Create mock onSearch callback
      const mockOnSearch = vi.fn();

      // Step 2: Render with mock callback
      const { getByPlaceholderText } = renderComponent({ onSearch: mockOnSearch });

      // Step 3: Type in search input
      const input = getByPlaceholderText('Search by policy name');
      fireEvent.change(input, { target: { value: 'new search' } });

      // Step 4: Verify callback was called with input value
      expect(mockOnSearch).toHaveBeenCalledWith('new search');
    });
  });

  describe('Add Button', () => {
    it('opens add dialog when clicked', async () => {
      // Step 1: Render component
      const { getByTestId, getByText } = renderComponent();

      // Step 2: Click Add button
      fireEvent.click(getByTestId('add-policy-button'));

      // Step 3: Verify dialog opens
      await waitFor(() => {
        expect(getByText('Add Policy')).toBeVisible();
      });
    });
  });

  describe('Add Policy Dialog', () => {
    it('calls createPolicy API with form values on submit', async () => {
      // Step 1: Setup - make createPolicy return {} (simulates successful API response)
      mockUseApi.policies.createPolicy.mockResolvedValueOnce({});

      // Step 2: Create mock refresh function to verify it's called after submit
      const mockRefresh = vi.fn();

      // Step 3: Render component with mock refresh prop
      const { getByTestId, getByLabelText, getByRole } = renderComponent({ refresh: mockRefresh });

      // Step 4: Click "Add" button to open dialog
      fireEvent.click(getByTestId('add-policy-button'));

      // Step 5: Wait for dialog to appear (async rendering)
      await waitFor(() => {
        expect(getByLabelText('Policy Name *')).toBeVisible();
      });

      // Step 6: Fill form fields
      fireEvent.change(getByLabelText('Policy Name *'), { target: { value: 'New Policy' } });
      fireEvent.change(getByLabelText('Description'), { target: { value: 'A description' } });

      // Step 7: Submit form
      fireEvent.click(getByRole('button', { name: /create/i }));

      // Step 8: Verify API was called with correct params
      await waitFor(() => {
        expect(mockUseApi.policies.createPolicy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Policy',
            description: 'A description'
          })
        );
      });

      // Step 9: Verify refresh was called after success
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('Empty State', () => {
    it('passes noRowsLabel to DataGrid', async () => {
      // Step 1: Render with empty policies array
      const { getByText } = renderComponent({ policies: [], rowCount: 0 });

      // Step 2: Verify empty state message appears (from DataGrid localeText)
      await waitFor(() => {
        expect(getByText('No Policies')).toBeVisible();
      });
    });
  });
});
