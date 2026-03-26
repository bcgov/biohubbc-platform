import { GridColDef } from '@mui/x-data-grid';
import { cleanup, within } from '@testing-library/react';
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

  it('renders secured icon for secured rows', () => {
    const securedResult = createMockSearchFeature(1, 'Dataset', true);

    const { getByTestId } = render(
      <SearchResultTableLayout
        results={[securedResult]}
        cartFeatureIds={new Set()}
        onRowSelectionModelChange={vi.fn()}
      />
    );

    const securedRow = getByTestId('row-1');
    const securedCell = within(securedRow).getByTestId('cell-is_secured');
    expect(securedCell.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render secured icon for unsecured rows', () => {
    const unsecuredResult = createMockSearchFeature(2, 'Observation', false);

    const { getByTestId } = render(
      <SearchResultTableLayout
        results={[unsecuredResult]}
        cartFeatureIds={new Set()}
        onRowSelectionModelChange={vi.fn()}
      />
    );

    const unsecuredRow = getByTestId('row-2');
    const unsecuredCell = within(unsecuredRow).getByTestId('cell-is_secured');
    expect(unsecuredCell).toBeEmptyDOMElement();
    expect(unsecuredCell.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders mixed secured and unsecured rows correctly', () => {
    const securedResult = createMockSearchFeature(1, 'Dataset', true);
    const unsecuredResult = createMockSearchFeature(2, 'Observation', false);

    const { getByTestId } = render(
      <SearchResultTableLayout
        results={[securedResult, unsecuredResult]}
        cartFeatureIds={new Set()}
        onRowSelectionModelChange={vi.fn()}
      />
    );

    const securedRow = getByTestId('row-1');
    const unsecuredRow = getByTestId('row-2');

    expect(securedRow).toBeVisible();
    expect(unsecuredRow).toBeVisible();
    expect(within(securedRow).getByTestId('cell-is_secured').querySelector('svg')).toBeInTheDocument();
    expect(within(unsecuredRow).getByTestId('cell-is_secured').querySelector('svg')).not.toBeInTheDocument();
  });
});
