import { TaxonPropertyValue } from 'interfaces/property-value.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { buildSubmissionPropertyValuePathResolvers } from 'utils/routes';
import { TaxonPropertyValueLink } from './TaxonPropertyValueLink';

const taxon: TaxonPropertyValue = { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' };

interface RenderOptions {
  submissionId?: number;
  getSubmissionTaxonPath?: (submissionId: number, taxonId: number) => string;
}

const renderLink = (value: TaxonPropertyValue, options: RenderOptions = {}) => {
  const {
    submissionId = 3,
    getSubmissionTaxonPath = buildSubmissionPropertyValuePathResolvers('/submission').getSubmissionTaxonPath
  } = options;

  return render(
    <MemoryRouter>
      <TaxonPropertyValueLink
        value={value}
        submissionId={submissionId}
        getSubmissionTaxonPath={getSubmissionTaxonPath}
      />
    </MemoryRouter>
  );
};

describe('TaxonPropertyValueLink', () => {
  it('links the label to the taxon path provided by the caller', () => {
    const getSubmissionTaxonPath = vi.fn(() => '/submission/3/taxon/180543?view=table');
    const { getByRole } = renderLink(taxon, { submissionId: 3, getSubmissionTaxonPath });

    const link = getByRole('link', { name: 'Ursus americanus' });
    expect(link).toHaveAttribute('href', '/submission/3/taxon/180543?view=table');
    expect(getSubmissionTaxonPath).toHaveBeenCalledWith(3, 180543);
  });

  it('uses the portal route base when given', () => {
    const { getByRole } = renderLink(taxon, {
      submissionId: 3,
      getSubmissionTaxonPath: buildSubmissionPropertyValuePathResolvers('/portal/submission').getSubmissionTaxonPath
    });

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
