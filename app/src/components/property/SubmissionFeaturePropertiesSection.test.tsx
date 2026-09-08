import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { buildSubmissionPropertyValuePathResolvers } from 'utils/routes';
import { SubmissionFeaturePropertiesSection } from './SubmissionFeaturePropertiesSection';

const rows = [
  { id: 'string:1', property: 'species name', value: 'Wolf' },
  {
    id: 'taxon:2',
    property: 'focal species',
    value: { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' }
  },
  {
    id: 'code:3',
    property: 'sign',
    value: { codeset_key: 'sign', codeset_label: 'Sign', code_key: 'track', code_label: 'Track', label: 'Track' }
  },
  {
    id: 'feature:4',
    property: 'sample site',
    value: { urn: 'urn:18:sample_site:3339', label: 'urn:18:sample_site:3339' }
  }
];

const renderSection = (props: Partial<Parameters<typeof SubmissionFeaturePropertiesSection>[0]> = {}) =>
  render(
    <MemoryRouter>
      <SubmissionFeaturePropertiesSection
        submissionId={1}
        pathResolvers={buildSubmissionPropertyValuePathResolvers('/submission')}
        rows={rows}
        rowCount={rows.length}
        isLoading={false}
        paginationModel={{ page: 0, pageSize: 10 }}
        setPaginationModel={vi.fn()}
        sortModel={[{ field: 'property', sort: 'asc' }]}
        setSortModel={vi.fn()}
        searchTerm=""
        onSearch={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('SubmissionFeaturePropertiesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders scalar values as text and reference values as links using caller-provided paths', async () => {
    const { findByText, findByRole } = renderSection({
      pathResolvers: buildSubmissionPropertyValuePathResolvers('/portal/submission')
    });

    expect(await findByText('Wolf')).toBeVisible();
    expect(await findByRole('link', { name: 'Ursus americanus' })).toHaveAttribute(
      'href',
      '/portal/submission/1/taxon/180543'
    );
    expect(await findByRole('link', { name: 'Track' })).toHaveAttribute('href', '/portal/submission/1/code/sign/track');
    expect(await findByRole('link', { name: 'urn:18:sample_site:3339' })).toHaveAttribute(
      'href',
      '/portal/submission/18/feature/3339'
    );
  });
});
