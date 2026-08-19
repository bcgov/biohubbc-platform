import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { JsonValue } from 'types/json';
import { PropertyValueDisplay } from './PropertyValueDisplay';

const taxon = { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' };

const renderValue = (value: JsonValue | undefined) =>
  render(
    <MemoryRouter>
      <PropertyValueDisplay value={value} submissionId={3} featureRouteBasePath="/submission" />
    </MemoryRouter>
  );

describe('PropertyValueDisplay', () => {
  it('renders nothing for absent values', () => {
    expect(renderValue(null).container).toBeEmptyDOMElement();
    expect(renderValue(undefined).container).toBeEmptyDOMElement();
  });

  it('renders scalar values as text', () => {
    expect(renderValue('wolf').container).toHaveTextContent('wolf');
    expect(renderValue(12).container).toHaveTextContent('12');
    expect(renderValue(false).container).toHaveTextContent('false');
  });

  it('renders non-reference objects such as GeoJSON as JSON text', () => {
    expect(renderValue({ type: 'Point', coordinates: [1, 2] }).container).toHaveTextContent(
      '{"type":"Point","coordinates":[1,2]}'
    );
    expect(renderValue({ label: 'structured value', meta: { count: 2 } }).container).toHaveTextContent(
      '{"label":"structured value","meta":{"count":2}}'
    );
  });

  it('renders a taxon value as a link to the taxon page', () => {
    const { getByRole } = renderValue(taxon);

    expect(getByRole('link', { name: 'Ursus americanus' })).toHaveAttribute('href', '/submission/3/taxon/180543');
  });

  it('renders multi-value properties inline, comma-separated', () => {
    const { container, getAllByRole } = renderValue([taxon, { ...taxon, taxon_id: 2, label: 'Canis lupus' }, 'x']);

    expect(container).toHaveTextContent('Ursus americanus, Canis lupus, x');
    expect(getAllByRole('link')).toHaveLength(2);
  });
});
