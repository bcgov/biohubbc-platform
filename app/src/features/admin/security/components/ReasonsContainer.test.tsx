import { GridColDef } from '@mui/x-data-grid';
import { fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { ISecurityReasonWithFeatureCount } from 'interfaces/useSecurityApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { IReasonsContainerProps, ReasonsContainer } from './ReasonsContainer';

interface MockDataGridProps {
  rows: ISecurityReasonWithFeatureCount[];
  columns: GridColDef[];
  localeText?: { noRowsLabel?: string };
}

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns, localeText }: MockDataGridProps) => (
    <div data-testid="mock-data-grid">
      {rows.length === 0 ? (
        <div>{localeText?.noRowsLabel}</div>
      ) : (
        rows.map((row) => (
          <div key={row.security_rule_id} data-testid={`row-${row.security_rule_id}`}>
            <span>{row.name}</span>
            <span>{row.description}</span>
            <span>{row.category_name}</span>
            <span>{row.feature_count}</span>
            {columns.find((c) => c.field === 'actions')?.renderCell?.({ row } as never)}
          </div>
        ))
      )}
    </div>
  )
}));

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockReasons: ISecurityReasonWithFeatureCount[] = [
  {
    security_rule_id: 1,
    security_category_id: 2,
    category_name: 'Health',
    name: 'Research',
    description: 'Research reason',
    feature_count: 4
  }
];

const mockCategoriesResponse = {
  categories: [{ security_category_id: 2, name: 'Health', description: 'Health category', rule_count: 1 }],
  pagination: { total: 1, current_page: 1, last_page: 1, per_page: 100 }
};

const mockCreateSecurityReason = vi.fn();
const mockUpdateSecurityReason = vi.fn();
const mockDeleteSecurityReason = vi.fn();
const mockGetSecurityCategories = vi.fn().mockResolvedValue(mockCategoriesResponse);

const mockUseApi = {
  security: {
    getSecurityCategories: mockGetSecurityCategories,
    createSecurityReason: mockCreateSecurityReason,
    updateSecurityReason: mockUpdateSecurityReason,
    deleteSecurityReason: mockDeleteSecurityReason
  }
};

const defaultProps: IReasonsContainerProps = {
  reasons: mockReasons,
  rowCount: 1,
  paginationModel: { page: 0, pageSize: 10 },
  setPaginationModel: vi.fn(),
  sortModel: [{ field: 'name', sort: 'asc' }],
  setSortModel: vi.fn(),
  refresh: vi.fn(),
  refreshCategories: vi.fn(),
  searchTerm: '',
  onSearch: vi.fn()
};

const renderComponent = (props: Partial<IReasonsContainerProps> = {}) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ReasonsContainer {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('ReasonsContainer', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
    mockGetSecurityCategories.mockResolvedValue(mockCategoriesResponse);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens add dialog when Add button is clicked', async () => {
    const { getByRole, getByText } = renderComponent();

    fireEvent.click(getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(getByText('Add Reason')).toBeVisible();
    });
  });

  it('calls createSecurityReason API on submit', async () => {
    mockCreateSecurityReason.mockResolvedValueOnce({});

    const mockRefresh = vi.fn();
    const mockRefreshCategories = vi.fn();
    const { getByRole, getByLabelText, queryByText } = renderComponent({
      refresh: mockRefresh,
      refreshCategories: mockRefreshCategories
    });

    fireEvent.click(getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(getByLabelText('Name *')).toBeVisible();
    });

    fireEvent.change(getByLabelText('Name *'), { target: { value: 'New Reason' } });
    fireEvent.change(getByLabelText('Description *'), { target: { value: 'A new reason' } });

    fireEvent.mouseDown(getByRole('combobox'));
    fireEvent.click(getByRole('option', { name: 'Health' }));

    fireEvent.click(getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockCreateSecurityReason).toHaveBeenCalledWith({
        name: 'New Reason',
        description: 'A new reason',
        security_category_id: 2
      });
    });

    await waitFor(() => {
      expect(queryByText('Add Reason')).toBeNull();
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockRefreshCategories).toHaveBeenCalled();
    });
  });
});
