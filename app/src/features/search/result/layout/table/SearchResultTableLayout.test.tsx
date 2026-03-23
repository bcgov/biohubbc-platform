import { GridColDef } from '@mui/x-data-grid';
import { cleanup } from '@testing-library/react';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { createMockSearchFeature } from 'test-helpers/cart-helpers';
import { render } from 'test-helpers/test-utils';
import { SearchResultTableLayout } from './SearchResultTableLayout';

interface MockDataGridProps {
  rows: SearchFeatureResultWithRelevancy[];
  columns: GridColDef[];
}

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: ({ rows, columns }: MockDataGridProps) => (
    <div data-testid="mock-data-grid">
      {rows.map((row) => (
        <div key={row.uuid} data-testid={`row-${row.submission_feature_id}`}>
          {columns
            .filter((c) => c.renderCell)
            .map((c) => (
              <div key={c.field} data-testid={`cell-${c.field}`}>
                {c.renderCell?.({ value: row[c.field as keyof SearchFeatureResultWithRelevancy], row } as never)}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}));

describe('SearchResultTableLayout', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders secured label for secured rows', () => {
    const securedResult = createMockSearchFeature(1, 'Dataset', true);

    const { getByText } = render(
      <SearchResultTableLayout
        results={[securedResult]}
        cartFeatureIds={new Set()}
        onRowSelectionModelChange={vi.fn()}
      />
    );

    expect(getByText('Secured')).toBeVisible();
  });

  it('does not render secured label for unsecured rows', () => {
    const unsecuredResult = createMockSearchFeature(2, 'Observation', false);

    const { queryByText } = render(
      <SearchResultTableLayout
        results={[unsecuredResult]}
        cartFeatureIds={new Set()}
        onRowSelectionModelChange={vi.fn()}
      />
    );

    expect(queryByText('Secured')).not.toBeInTheDocument();
  });

  it('renders mixed secured and unsecured rows correctly', () => {
    const securedResult = createMockSearchFeature(1, 'Dataset', true);
    const unsecuredResult = createMockSearchFeature(2, 'Observation', false);

    const { getByTestId, getAllByText } = render(
      <SearchResultTableLayout
        results={[securedResult, unsecuredResult]}
        cartFeatureIds={new Set()}
        onRowSelectionModelChange={vi.fn()}
      />
    );

    expect(getByTestId('row-1')).toBeVisible();
    expect(getByTestId('row-2')).toBeVisible();
    expect(getAllByText('Secured')).toHaveLength(1);
  });
});
