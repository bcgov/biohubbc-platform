import { TaxonPropertyValue } from 'interfaces/property-value.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { TaxonPropertyValueLink } from './TaxonPropertyValueLink';

const taxon: TaxonPropertyValue = { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' };

interface RenderOptions {
  submissionId?: string | number;
  featureRouteBasePath?: string;
  initialEntry?: string;
}

const renderLink = (value: TaxonPropertyValue, options: RenderOptions = {}) => {
  const { submissionId = 3, featureRouteBasePath = '/submission', initialEntry = '/x' } = options;

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TaxonPropertyValueLink value={value} submissionId={submissionId} featureRouteBasePath={featureRouteBasePath} />
    </MemoryRouter>
  );
};

describe('TaxonPropertyValueLink', () => {
  it('links the label to the taxon page under the referencing submission, keeping the query string', () => {
    const { getByRole } = renderLink(taxon, { submissionId: 3, initialEntry: '/x?view=table' });

    const link = getByRole('link', { name: 'Ursus americanus' });
    expect(link).toHaveAttribute('href', '/submission/3/taxon/180543?view=table');
    expect(link).toHaveAttribute('data-taxon-id', '180543');
    expect(link).toHaveAttribute('data-tsn', '180543');
  });

  it('uses the portal route base when given', () => {
    const { getByRole } = renderLink(taxon, { submissionId: '3', featureRouteBasePath: '/portal/submission' });

    expect(getByRole('link', { name: 'Ursus americanus' })).toHaveAttribute(
      'href',
      '/portal/submission/3/taxon/180543'
    );
  });

  it('describes the taxon with its TSN and rank', () => {
    const { getByRole } = renderLink(taxon, { submissionId: 3 });

    expect(getByRole('link')).toHaveAttribute('title', 'TSN 180543 · Species');
  });

  it('italicizes ranks written in scientific-name style and not higher ranks', () => {
    const { getByRole, unmount } = renderLink(taxon, { submissionId: 3 });
    expect(getByRole('link').querySelector('i')).toHaveTextContent('Ursus americanus');
    unmount();

    const { getByRole: getFamilyLink } = renderLink(
      { ...taxon, rank: 'Family', label: 'Ursidae' },
      { submissionId: 3 }
    );
    expect(getFamilyLink('link').querySelector('i')).toBeNull();
  });

  it('omits the rank from the title when it is unknown', () => {
    const { getByRole } = renderLink({ ...taxon, rank: null }, { submissionId: 3 });

    const link = getByRole('link');
    expect(link).toHaveAttribute('title', 'TSN 180543');
    expect(link.querySelector('i')).toBeNull();
  });
});
