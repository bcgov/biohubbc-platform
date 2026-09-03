import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { ComponentProps } from 'react';
import { render } from 'test-helpers/test-utils';
import { SubmissionFeatureDetailContent } from './SubmissionFeatureDetailContent';

// The map owns its own data loading and is covered by its own suite; this one is about the page layout.
vi.mock('./map/SubmissionFeatureMap', () => ({
  SubmissionFeatureMap: (props: { submissionId: number; submissionFeatureId: number }) => (
    <div data-testid="submission-feature-map-stub" data-props={JSON.stringify(props)} />
  )
}));

// The Properties section fetches indexed properties through `useApi`; stub it so these tests stay focused on
// the detail content's own rendering (banners and section layout). The section owns its own
// heading, so the stub renders one to keep it visible to the section-ordering assertion below.
vi.mock('components/property/FeaturePropertiesSection', () => ({
  FeaturePropertiesSection: () => <h2>Properties</h2>
}));

const mockFeature: ISubmissionFeature = {
  submission_feature_id: 10,
  uuid: 'feat-uuid-1',
  urn: 'urn:test:1',
  create_date: '2026-01-02T12:00:00.000Z',
  submission_id: 1,
  feature_type_id: 100,
  feature_type_name: 'observation',
  feature_type_display_name: 'Observation',
  submission_name: 'Test Submission',
  contributor_name: 'SIMS',
  source_id: null,
  successor_submission_feature_id: null,
  data: {},
  secured: false,
  security_reasons: []
};

const defaultProps: ComponentProps<typeof SubmissionFeatureDetailContent> = {
  feature: mockFeature,
  featureRouteBasePath: '/submission'
};

const renderComponent = (props?: Partial<ComponentProps<typeof SubmissionFeatureDetailContent>>) =>
  render(<SubmissionFeatureDetailContent {...defaultProps} {...props} />);

describe('SubmissionFeatureDetailContent', () => {
  it('renders the superseded banner when the feature has a successor', () => {
    const { getByText } = renderComponent({
      feature: { ...mockFeature, successor_submission_feature_id: 11 }
    });

    expect(getByText('This feature has been superseded')).toBeInTheDocument();
    expect(getByText('This information has been updated with a newer version.')).toBeInTheDocument();
  });

  it('does not render the superseded banner when the feature has no successor', () => {
    const { queryByText } = renderComponent();

    expect(queryByText('This feature has been superseded')).toBeNull();
  });

  describe('detail sections', () => {
    it('places Map and About after Properties', () => {
      const { getAllByRole } = renderComponent();

      const sectionLabels = getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

      expect(sectionLabels).toEqual(['Properties', 'Map', 'About']);
    });

    it('maps the feature being viewed', () => {
      const { getByTestId } = renderComponent();

      expect(JSON.parse(getByTestId('submission-feature-map-stub').dataset.props ?? '{}')).toEqual({
        submissionId: mockFeature.submission_id,
        submissionFeatureId: mockFeature.submission_feature_id
      });
    });
  });

  describe('about section', () => {
    it('lists the feature create date, contributor and UUID after the map', () => {
      const { getByText } = renderComponent();

      expect(getByText('January 2, 2026')).toBeVisible();
      expect(getByText('SIMS')).toBeVisible();
      expect(getByText('feat-uuid-1')).toBeVisible();
    });
  });
});
