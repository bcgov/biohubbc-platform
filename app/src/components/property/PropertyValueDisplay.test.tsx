import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { PropertyValueDisplay } from './PropertyValueDisplay';

const renderValue = (value: unknown, featureRouteBasePath = '/submission') =>
  render(
    <MemoryRouter>
      <PropertyValueDisplay value={value} featureRouteBasePath={featureRouteBasePath} />
    </MemoryRouter>
  );

describe('PropertyValueDisplay', () => {
  it('renders a feature reference as a link to the referenced feature detail page', () => {
    const { getByRole } = renderValue({ urn: 'urn:18:sample_site:3339', label: 'urn:18:sample_site:3339' });

    const link = getByRole('link', { name: 'urn:18:sample_site:3339' });
    expect(link).toHaveAttribute('href', '/submission/18/feature/3339');
  });

  it('uses the provided base path for feature links', () => {
    const { getByRole } = renderValue(
      { urn: 'urn:18:sample_site:3339', label: 'urn:18:sample_site:3339' },
      '/portal/submission'
    );

    expect(getByRole('link', { name: /3339/ })).toHaveAttribute('href', '/portal/submission/18/feature/3339');
  });

  it('renders an unresolvable feature urn as inert text (no link)', () => {
    const { getByText, queryByRole } = renderValue({ urn: 'urn:*:telemetry:*', label: 'urn:*:telemetry:*' });

    expect(getByText('urn:*:telemetry:*')).toBeInTheDocument();
    expect(queryByRole('link')).toBeNull();
  });

  it('renders a taxon value label as a link-like but inert element', () => {
    const { getByText, queryByRole } = renderValue({
      taxon_id: 180543,
      tsn: 180543,
      rank: 'species',
      label: 'Ursus americanus'
    });

    expect(getByText('Ursus americanus')).toBeInTheDocument();
    expect(queryByRole('link')).toBeNull();
  });

  it('renders a code value label', () => {
    const { getByText, queryByRole } = renderValue({
      codeset_key: 'sign',
      codeset_label: 'Sign',
      code_key: 'track',
      code_label: 'Track',
      label: 'Track'
    });

    expect(getByText('Track')).toBeInTheDocument();
    expect(queryByRole('link')).toBeNull();
  });

  it('renders array values inline with separators', () => {
    const { container } = renderValue([
      { taxon_id: 1, tsn: 1, rank: 'species', label: 'Ursus americanus' },
      { taxon_id: 2, tsn: 2, rank: 'species', label: 'Canis lupus' }
    ]);

    expect(container.textContent).toBe('Ursus americanus, Canis lupus');
  });

  it('renders scalar values as text', () => {
    const { container } = renderValue('wolf');

    expect(container.textContent).toBe('wolf');
  });

  it('stringifies non-reference objects such as GeoJSON', () => {
    const { container } = renderValue({ type: 'Point', coordinates: [1, 2] });

    expect(container.textContent).toBe('{"type":"Point","coordinates":[1,2]}');
  });
});
