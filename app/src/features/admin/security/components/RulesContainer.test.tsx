import { GridColDef } from '@mui/x-data-grid';
import { fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { ISecurityRuleWithFeatureCount } from 'interfaces/useSecurityApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { IRulesContainerProps, RulesContainer } from './RulesContainer';

interface MockDataGridProps {
  rows: ISecurityRuleWithFeatureCount[];
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
            {columns.find((c) => c.field === 'is_active')?.renderCell?.({ row, value: row.is_active } as never)}
            {columns.find((c) => c.field === 'actions')?.renderCell?.({ row } as never)}
          </div>
        ))
      )}
    </div>
  )
}));

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockRules: ISecurityRuleWithFeatureCount[] = [
  {
    security_rule_id: 1,
    security_category_id: 2,
    category_name: 'Health',
    name: 'Research',
    description: 'Research rule',
    is_active: true,
    feature_count: 4
  },
  {
    security_rule_id: 2,
    security_category_id: 2,
    category_name: 'Health',
    name: 'Inactive Rule',
    description: 'Disabled rule',
    is_active: false,
    feature_count: 0
  }
];

const mockCategoriesResponse = {
  categories: [{ security_category_id: 2, name: 'Health', description: 'Health category', rule_count: 1 }],
  pagination: { total: 1, current_page: 1, last_page: 1, per_page: 100 }
};

const mockCreateSecurityRule = vi.fn();
const mockUpdateSecurityRule = vi.fn();
const mockDeleteSecurityRule = vi.fn();
const mockGetSecurityCategories = vi.fn().mockResolvedValue(mockCategoriesResponse);

const mockUseApi = {
  security: {
    getSecurityCategories: mockGetSecurityCategories,
    createSecurityRule: mockCreateSecurityRule,
    updateSecurityRule: mockUpdateSecurityRule,
    deleteSecurityRule: mockDeleteSecurityRule
  }
};

const defaultProps: IRulesContainerProps = {
  rules: mockRules,
  rowCount: 1,
  paginationModel: { page: 0, pageSize: 10 },
  setPaginationModel: vi.fn(),
  sortModel: [{ field: 'name', sort: 'asc' }],
  setSortModel: vi.fn(),
  refresh: vi.fn(),
  searchTerm: '',
  onSearch: vi.fn()
};

const renderComponent = (props: Partial<IRulesContainerProps> = {}) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <RulesContainer {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('RulesContainer', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
    mockGetSecurityCategories.mockResolvedValue(mockCategoriesResponse);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders Active and Inactive status chips', () => {
    const { getByText } = renderComponent({ rules: mockRules, rowCount: 2 });

    expect(getByText('Active')).toBeVisible();
    expect(getByText('Inactive')).toBeVisible();
  });

  it('opens add dialog when Add button is clicked', async () => {
    const { getByRole, getByText } = renderComponent();

    fireEvent.click(getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(getByText('Add Rule')).toBeVisible();
    });
  });

  it('calls createSecurityRule API on submit', async () => {
    mockCreateSecurityRule.mockResolvedValueOnce({});

    const mockRefresh = vi.fn();
    const { getByRole, getByLabelText, queryByText } = renderComponent({
      refresh: mockRefresh
    });

    fireEvent.click(getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(getByLabelText('Name *')).toBeVisible();
    });

    fireEvent.change(getByLabelText('Name *'), { target: { value: 'New Rule' } });
    fireEvent.change(getByLabelText('Description *'), { target: { value: 'A new rule' } });

    fireEvent.mouseDown(getByRole('combobox'));
    fireEvent.click(getByRole('option', { name: 'Health' }));

    fireEvent.click(getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockCreateSecurityRule).toHaveBeenCalledWith({
        name: 'New Rule',
        description: 'A new rule',
        security_category_id: 2,
        is_active: true
      });
    });

    await waitFor(() => {
      expect(queryByText('Add Rule')).toBeNull();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
