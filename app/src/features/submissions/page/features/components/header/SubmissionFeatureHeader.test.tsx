import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { SubmissionFeatureHeader } from './SubmissionFeatureHeader';

const mockFeature: ISubmissionFeature = {
  submission_feature_id: 10,
  uuid: 'feat-uuid-1',
  urn: 'urn:test:1',
  create_date: '2026-01-02T12:00:00.000Z',
  submission_id: 1,
  feature_type_id: 100,
  feature_type_name: 'species_observation',
  feature_type_display_name: 'Observation',
  submission_name: 'Test Submission',
  contributor_name: 'SIMS',
  source_id: null,
  successor_submission_feature_id: null,
  data: {},
  secured: true,
  security_reasons: []
};

const renderHeader = (feature: ISubmissionFeature = mockFeature) =>
  render(
    <MemoryRouter>
      <SubmissionFeatureHeader
        feature={feature}
        rootBreadcrumbLabel="Submissions"
        rootBreadcrumbTo="/submissions"
        submissionDetailBasePath="/submission"
        activeTab="details"
        onTabChange={vi.fn()}
      />
    </MemoryRouter>
  );

describe('SubmissionFeatureHeader', () => {
  it('renders the Details tab as selected', () => {
    const { getByRole } = renderHeader();

    expect(getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('links the feature type chip to search results for that feature type', () => {
    const { getByRole } = renderHeader();

    expect(getByRole('link', { name: 'Species Observation' })).toHaveAttribute('href', '/search/species_observation');
  });

  it('falls back to the API display name for feature types without a configured label', () => {
    const { getByRole } = renderHeader({
      ...mockFeature,
      feature_type_name: 'future_feature_type',
      feature_type_display_name: 'Future Feature Type'
    });

    expect(getByRole('link', { name: 'Future Feature Type' })).toHaveAttribute('href', '/search/future_feature_type');
  });

  it('renders the secured chip with the error colour and no click handler', () => {
    const { getByText } = renderHeader();

    const securedChip = getByText('Secured').closest('.MuiChip-root');
    expect(securedChip).toHaveClass('MuiChip-colorError');
    expect(securedChip).not.toHaveClass('MuiChip-clickable');
  });

  it('does not render the secured chip for unsecured features', () => {
    const { queryByText } = renderHeader({ ...mockFeature, secured: false });

    expect(queryByText('Secured')).toBeNull();
  });
});
