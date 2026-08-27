import { GridColDef } from '@mui/x-data-grid';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { FeatureTypeProperty } from 'interfaces/useCodesApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createMockSearchFeature } from 'test-helpers/search-result-helpers';
import { render } from 'test-helpers/test-utils';
import { SearchResultTableLayout } from './SearchResultTableLayout';

interface MockDataGridProps {
  rows: SearchFeatureResultWithRelevancy[];
  columns: GridColDef[];
  onRowClick?: (params: { row: SearchFeatureResultWithRelevancy }) => void;
  paginationModel?: { page: number; pageSize: number };
  pageSizeOptions?: number[];
}

vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: ({ rows, columns, onRowClick, paginationModel, pageSizeOptions }: MockDataGridProps) => (
    <div
      data-testid="mock-data-grid"
      data-has-pagination-model={String(Boolean(paginationModel))}
      data-page-size-options={pageSizeOptions?.join(',')}>
      <div data-testid="columns">{columns.map((column) => column.headerName).join('|')}</div>
      <div data-testid="column-fields">{columns.map((column) => column.field).join('|')}</div>
      {rows.map((row) => (
        <div key={row.uuid} data-testid={`row-${row.submission_feature_id}`} onClick={() => onRowClick?.({ row })}>
          {columns
            .filter((c) => c.renderCell || c.valueGetter)
            .map((c) => {
              const valueGetter = c.valueGetter as
                | ((
                    value: unknown,
                    row: SearchFeatureResultWithRelevancy,
                    column: GridColDef,
                    apiRef: unknown
                  ) => unknown)
                | undefined;
              const rowValue = row[c.field as keyof SearchFeatureResultWithRelevancy];
              const value = valueGetter?.(rowValue, row, c, {}) ?? rowValue;
              const renderedValue = (c.renderCell?.({ value, row } as never) ?? value) as ReactNode;

              return (
                <div key={c.field} data-testid={`cell-${c.field}`}>
                  {renderedValue}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  )
}));

describe('SearchResultTableLayout', () => {
  const featureTypeProperties: FeatureTypeProperty[] = [
    {
      feature_type_property_id: 1,
      name: 'scientific_name',
      display_name: 'Scientific Name',
      description: null,
      type_name: 'string',
      required_value: false,
      calculated_value: false,
      allow_multiple: false
    },
    {
      feature_type_property_id: 2,
      name: 'count',
      display_name: 'Count',
      description: null,
      type_name: 'number',
      required_value: false,
      calculated_value: false,
      allow_multiple: false
    },
    {
      feature_type_property_id: 3,
      name: 'tags',
      display_name: 'Tags',
      description: null,
      type_name: 'string',
      required_value: false,
      calculated_value: false,
      allow_multiple: true
    }
  ];

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders secured icon for secured rows', () => {
    const securedResult = createMockSearchFeature(1, 'Survey', true);

    const { getByTestId } = render(
      <MemoryRouter>
        <SearchResultTableLayout results={[securedResult]} featureTypeProperties={[]} />
      </MemoryRouter>
    );

    const securedRow = getByTestId('row-1');
    const securedCell = within(securedRow).getByTestId('cell-is_secured');
    expect(securedCell.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render secured icon for unsecured rows', () => {
    const unsecuredResult = createMockSearchFeature(2, 'Observation', false);

    const { getByTestId } = render(
      <MemoryRouter>
        <SearchResultTableLayout results={[unsecuredResult]} featureTypeProperties={[]} />
      </MemoryRouter>
    );

    const unsecuredRow = getByTestId('row-2');
    const unsecuredCell = within(unsecuredRow).getByTestId('cell-is_secured');
    expect(unsecuredCell).toBeEmptyDOMElement();
    expect(unsecuredCell.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders mixed secured and unsecured rows correctly', () => {
    const securedResult = createMockSearchFeature(1, 'Survey', true);
    const unsecuredResult = createMockSearchFeature(2, 'Observation', false);

    const { getByTestId } = render(
      <MemoryRouter>
        <SearchResultTableLayout results={[securedResult, unsecuredResult]} featureTypeProperties={[]} />
      </MemoryRouter>
    );

    const securedRow = getByTestId('row-1');
    const unsecuredRow = getByTestId('row-2');

    expect(securedRow).toBeVisible();
    expect(unsecuredRow).toBeVisible();
    expect(within(securedRow).getByTestId('cell-is_secured').querySelector('svg')).toBeInTheDocument();
    expect(within(unsecuredRow).getByTestId('cell-is_secured').querySelector('svg')).not.toBeInTheDocument();
  });

  it('calls onClick when a row is clicked', () => {
    const result = createMockSearchFeature(1, 'Survey', false);
    const onClick = vi.fn();

    const { getByTestId } = render(
      <MemoryRouter>
        <SearchResultTableLayout results={[result]} featureTypeProperties={[]} onClick={onClick} />
      </MemoryRouter>
    );

    fireEvent.click(getByTestId('row-1'));

    expect(onClick).toHaveBeenCalledWith(result);
  });

  it('renders a column for each feature type property', () => {
    const result = {
      ...createMockSearchFeature(1, 'Survey', false),
      properties: {
        scientific_name: 'Canis lupus',
        count: 12,
        tags: ['coastal', 'survey']
      }
    };

    const { getByTestId } = render(
      <MemoryRouter>
        <SearchResultTableLayout results={[result]} featureTypeProperties={featureTypeProperties} />
      </MemoryRouter>
    );

    expect(getByTestId('columns')).toHaveTextContent('Scientific Name');
    expect(getByTestId('columns')).toHaveTextContent('Count');
    expect(getByTestId('columns')).toHaveTextContent('Tags');
    expect(getByTestId('column-fields')).toHaveTextContent('1');
    expect(getByTestId('column-fields')).not.toHaveTextContent('property:scientific_name');
    expect(getByTestId('cell-1')).toHaveTextContent('Canis lupus');
    expect(getByTestId('cell-2')).toHaveTextContent('12');
    expect(getByTestId('cell-3')).toHaveTextContent('coastal, survey');
    expect(getByTestId('cell-1').querySelector('.MuiTypography-root')).toBeInTheDocument();
  });

  it('renders taxon values as links to the taxon page under the row submission', () => {
    const taxonProperty: FeatureTypeProperty = {
      feature_type_property_id: 4,
      name: 'focal_species',
      display_name: 'Focal Species',
      description: null,
      type_name: 'taxon',
      required_value: false,
      calculated_value: false,
      allow_multiple: false
    };
    const result = {
      ...createMockSearchFeature(1, 'Survey', false),
      properties: {
        focal_species: { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' }
      }
    };

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/search/survey?view=table']}>
        <SearchResultTableLayout results={[result]} featureTypeProperties={[taxonProperty]} />
      </MemoryRouter>
    );

    const cell = getByTestId(`cell-${taxonProperty.feature_type_property_id}`);
    expect(cell).toHaveTextContent('Ursus americanus');
    expect(within(cell).getByRole('link', { name: 'Ursus americanus' })).toHaveAttribute(
      'href',
      '/submission/101/taxon/180543?view=table'
    );
    expect(cell.querySelector('.MuiTypography-root')).toHaveAttribute('title', 'Ursus americanus');
  });

  it('renders multi-value taxon properties as a comma-separated list of links', () => {
    const taxonProperty: FeatureTypeProperty = {
      feature_type_property_id: 5,
      name: 'associated_species',
      display_name: 'Associated Species',
      description: null,
      type_name: 'taxon',
      required_value: false,
      calculated_value: false,
      allow_multiple: true
    };
    const result = {
      ...createMockSearchFeature(1, 'Survey', false),
      properties: {
        associated_species: [
          { taxon_id: 1, tsn: 1, rank: 'Species', label: 'Ursus americanus' },
          { taxon_id: 2, tsn: 2, rank: 'Species', label: 'Canis lupus' }
        ]
      }
    };

    const { getByTestId } = render(
      <MemoryRouter>
        <SearchResultTableLayout results={[result]} featureTypeProperties={[taxonProperty]} />
      </MemoryRouter>
    );

    const cell = getByTestId(`cell-${taxonProperty.feature_type_property_id}`);
    expect(cell).toHaveTextContent('Ursus americanus, Canis lupus');
    expect(within(cell).getAllByRole('link')).toHaveLength(2);
  });

  it('does not configure internal data grid pagination', () => {
    const results = Array.from({ length: 25 }, (_value, index) =>
      createMockSearchFeature(index + 1, `Survey ${index + 1}`, false)
    );

    const { getByTestId } = render(
      <MemoryRouter>
        <SearchResultTableLayout results={results} featureTypeProperties={[]} />
      </MemoryRouter>
    );

    expect(getByTestId('mock-data-grid')).toHaveAttribute('data-has-pagination-model', 'false');
    expect(getByTestId('mock-data-grid')).not.toHaveAttribute('data-page-size-options');
  });
});
