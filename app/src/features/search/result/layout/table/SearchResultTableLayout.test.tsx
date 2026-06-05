import { GridColDef } from '@mui/x-data-grid';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { createMockSearchFeature } from 'test-helpers/cart-helpers';
import { render } from 'test-helpers/test-utils';
import { SearchResultTableLayout } from './SearchResultTableLayout';

interface MockDataGridProps {
  rows: SearchFeatureResultWithRelevancy[];
  columns: GridColDef[];
  onRowClick?: (params: { row: SearchFeatureResultWithRelevancy }) => void;
}

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: ({ rows, columns, onRowClick }: MockDataGridProps) => (
    <div data-testid="mock-data-grid">
      {rows.map((row) => (
        <div key={row.uuid} data-testid={`row-${row.submission_feature_id}`} onClick={() => onRowClick?.({ row })}>
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

    const { getByTestId } = render(<SearchResultTableLayout results={[securedResult]} cartFeatureIds={new Set()} />);

    const securedRow = getByTestId('row-1');
    const securedCell = within(securedRow).getByTestId('cell-is_secured');
    expect(securedCell.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render secured icon for unsecured rows', () => {
    const unsecuredResult = createMockSearchFeature(2, 'Observation', false);

    const { getByTestId } = render(<SearchResultTableLayout results={[unsecuredResult]} cartFeatureIds={new Set()} />);

    const unsecuredRow = getByTestId('row-2');
    const unsecuredCell = within(unsecuredRow).getByTestId('cell-is_secured');
    expect(unsecuredCell).toBeEmptyDOMElement();
    expect(unsecuredCell.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders mixed secured and unsecured rows correctly', () => {
    const securedResult = createMockSearchFeature(1, 'Dataset', true);
    const unsecuredResult = createMockSearchFeature(2, 'Observation', false);

    const { getByTestId } = render(
      <SearchResultTableLayout results={[securedResult, unsecuredResult]} cartFeatureIds={new Set()} />
    );

    const securedRow = getByTestId('row-1');
    const unsecuredRow = getByTestId('row-2');

    expect(securedRow).toBeVisible();
    expect(unsecuredRow).toBeVisible();
    expect(within(securedRow).getByTestId('cell-is_secured').querySelector('svg')).toBeInTheDocument();
    expect(within(unsecuredRow).getByTestId('cell-is_secured').querySelector('svg')).not.toBeInTheDocument();
  });

  it('calls onClick when a row is clicked', () => {
    const result = createMockSearchFeature(1, 'Dataset', false);
    const onClick = vi.fn();

    const { getByTestId } = render(
      <SearchResultTableLayout results={[result]} cartFeatureIds={new Set()} onClick={onClick} />
    );

    fireEvent.click(getByTestId('row-1'));

    expect(onClick).toHaveBeenCalledWith(result);
  });

  it('does not call onClick when an action button is clicked', () => {
    const result = createMockSearchFeature(1, 'Dataset', false);
    const onClick = vi.fn();
    const onAddToCart = vi.fn();

    const { getByRole } = render(
      <SearchResultTableLayout
        results={[result]}
        cartFeatureIds={new Set()}
        onClick={onClick}
        onAddToCart={onAddToCart}
      />
    );

    fireEvent.click(getByRole('button', { name: 'Add' }));

    expect(onAddToCart).toHaveBeenCalledWith(result);
    expect(onClick).not.toHaveBeenCalled();
  });
});
