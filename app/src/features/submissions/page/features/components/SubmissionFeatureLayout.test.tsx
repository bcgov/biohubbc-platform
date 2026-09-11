import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { SubmissionFeatureLayout } from './SubmissionFeatureLayout';

vi.mock('./map/SubmissionFeatureMap', () => ({
  SubmissionFeatureMap: () => <div data-testid="feature-map" />
}));

const mockFeature: ISubmissionFeature = {
  submission_feature_id: 10,
  uuid: 'feat-uuid-1',
  urn: 'urn:test:1',
  create_date: '2026-01-02T12:00:00.000Z',
  submission_id: 1,
  feature_type_id: 100,
  feature_type_name: 'observation',
  submission_name: 'Test Submission',
  contributor_name: 'SIMS',
  source_id: null,
  successor_submission_feature_id: null,
  data: {},
  secured: false,
  security_reasons: []
};

const renderLayout = (feature?: ISubmissionFeature, isLoading = false) =>
  render(
    <MemoryRouter>
      <SubmissionFeatureLayout
        feature={feature}
        isLoading={isLoading}
        rootBreadcrumbLabel="Search"
        rootBreadcrumbTo="/search"
        submissionDetailBasePath="/submission"
        breadcrumbs={<nav aria-label="review breadcrumb">Validation</nav>}>
        <h2>Review properties</h2>
      </SubmissionFeatureLayout>
    </MemoryRouter>
  );

describe('SubmissionFeatureLayout', () => {
  it('combines review content and breadcrumbs with the feature header, warning, and metadata', () => {
    const { getByRole, getByLabelText, getByText, getByTestId } = renderLayout({
      ...mockFeature,
      successor_submission_feature_id: 11
    });
    expect(getByLabelText('review breadcrumb')).toHaveTextContent('Validation');
    expect(getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    expect(getByRole('heading', { name: 'Review properties' })).toBeVisible();
    expect(getByText('This feature has been superseded')).toBeVisible();
    expect(getByText('feat-uuid-1')).toBeVisible();
    expect(getByTestId('feature-map')).toBeVisible();
  });

  it('keeps loaded detail content visible during a refresh', () => {
    const { getByRole } = renderLayout(mockFeature, true);
    expect(getByRole('heading', { name: 'Review properties' })).toBeVisible();
  });

  it('shows the empty state without rendering detail content when the feature is missing', () => {
    const { getByText, queryByRole } = renderLayout();
    expect(getByText('No data available')).toBeVisible();
    expect(queryByRole('heading', { name: 'Review properties' })).not.toBeInTheDocument();
  });
});
