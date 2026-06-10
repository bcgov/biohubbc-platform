import { GridColDef } from '@mui/x-data-grid';
import { fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { ISecurityCategoryWithRuleCount } from 'interfaces/useSecurityApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { CategoriesContainer, ICategoriesContainerProps } from './CategoriesContainer';

interface MockDataGridProps {
  rows: ISecurityCategoryWithRuleCount[];
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
          <div key={row.security_category_id} data-testid={`row-${row.security_category_id}`}>
            <span>{row.name}</span>
            <span>{row.description}</span>
            <span>{row.rule_count}</span>
            {columns.find((c) => c.field === 'actions')?.renderCell?.({ row } as never)}
          </div>
        ))
      )}
    </div>
  )
}));

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockCategories: ISecurityCategoryWithRuleCount[] = [
  {
    security_category_id: 1,
    name: 'Health',
    description: 'Health category',
    rule_count: 3
  }
];

const mockCreateSecurityCategory = vi.fn();
const mockUpdateSecurityCategory = vi.fn();
const mockDeleteSecurityCategory = vi.fn();

const mockUseApi = {
  security: {
    createSecurityCategory: mockCreateSecurityCategory,
    updateSecurityCategory: mockUpdateSecurityCategory,
    deleteSecurityCategory: mockDeleteSecurityCategory
  }
};

const defaultProps: ICategoriesContainerProps = {
  categories: mockCategories,
  rowCount: 1,
  paginationModel: { page: 0, pageSize: 10 },
  setPaginationModel: vi.fn(),
  sortModel: [{ field: 'name', sort: 'asc' }],
  setSortModel: vi.fn(),
  refresh: vi.fn(),
  searchTerm: '',
  onSearch: vi.fn()
};

const renderComponent = (props: Partial<ICategoriesContainerProps> = {}) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CategoriesContainer {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('CategoriesContainer', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens add dialog when Add button is clicked', async () => {
    const { getByRole, getByText } = renderComponent();

    fireEvent.click(getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(getByText('Add Category')).toBeVisible();
    });
  });

  it('calls createSecurityCategory API on submit', async () => {
    mockCreateSecurityCategory.mockResolvedValueOnce({});
    const mockRefresh = vi.fn();

    const { getByRole, getByLabelText, queryByText } = renderComponent({ refresh: mockRefresh });

    fireEvent.click(getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(getByLabelText('Name *')).toBeVisible();
    });

    fireEvent.change(getByLabelText('Name *'), { target: { value: 'New Category' } });
    fireEvent.change(getByLabelText('Description *'), { target: { value: 'A new category' } });
    fireEvent.click(getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockCreateSecurityCategory).toHaveBeenCalledWith({
        name: 'New Category',
        description: 'A new category'
      });
    });

    await waitFor(() => {
      expect(queryByText('Add Category')).toBeNull();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
