import { render, screen } from '@testing-library/react';
import { SecurityReviewFeatureTable } from './SecurityReviewFeatureTable';

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: ({ columns }: { columns: Array<{ field: string; headerName?: string }> }) => (
    <div data-testid="feature-grid">
      {columns.map((column) => (
        <span key={column.field}>{column.headerName}</span>
      ))}
    </div>
  )
}));

vi.mock('features/search/result/header/SearchResultSearch', () => ({
  SearchResultSearch: () => <div data-testid="feature-expression-search" />
}));

describe('SecurityReviewFeatureTable', () => {
  it('renders expression search below the Features section header', () => {
    render(
      <SecurityReviewFeatureTable
        rows={[]}
        totalCount={0}
        isLoading={false}
        searchTerm=""
        expressionTree={null}
        cursor={{ limit: 10, sort: 'relevancy_score', order: 'desc', next: null, previous: null }}
        selectedFeatureIds={[]}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        onExpressionApply={vi.fn()}
        onOpenProperties={vi.fn()}
        onOpenSecurity={vi.fn()}
      />
    );

    const heading = screen.getByRole('heading', { name: 'Features (0)' });
    const search = screen.getByTestId('feature-expression-search');

    expect(heading.closest('.MuiPaper-root')).toContainElement(search);
    expect(heading.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the parent feature ID column', () => {
    render(
      <SecurityReviewFeatureTable
        rows={[]}
        totalCount={0}
        isLoading={false}
        searchTerm=""
        expressionTree={null}
        cursor={{ limit: 10, sort: 'relevancy_score', order: 'desc', next: null, previous: null }}
        selectedFeatureIds={[]}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        onExpressionApply={vi.fn()}
        onOpenProperties={vi.fn()}
        onOpenSecurity={vi.fn()}
      />
    );

    expect(screen.getByText('Parent')).toBeVisible();
  });
});
