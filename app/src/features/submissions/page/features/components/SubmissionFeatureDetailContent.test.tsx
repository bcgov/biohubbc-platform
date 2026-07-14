import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { SubmissionFeatureDetailContent } from './SubmissionFeatureDetailContent';

const mockFeature: ISubmissionFeature = {
  submission_feature_id: 10,
  uuid: 'feat-uuid-1',
  urn: 'urn:test:1',
  submission_id: 1,
  feature_type_id: 100,
  feature_type_name: 'observation',
  feature_type_display_name: 'Observation',
  submission_name: 'Test Submission',
  source_id: null,
  data: {},
  secured: false,
  security_reasons: []
};

const defaultProps: ComponentProps<typeof SubmissionFeatureDetailContent> = {
  isLoading: false,
  feature: mockFeature,
  relatedFeatures: [],
  submissionId: '1',
  rootBreadcrumbLabel: 'Submissions',
  rootBreadcrumbTo: '/submissions',
  submissionDetailBasePath: '/submission'
};

const renderComponent = (props?: Partial<ComponentProps<typeof SubmissionFeatureDetailContent>>) =>
  render(
    <MemoryRouter>
      <SubmissionFeatureDetailContent {...defaultProps} {...props} />
    </MemoryRouter>
  );

describe('SubmissionFeatureDetailContent', () => {
  it('renders the secured banner with reasons when the feature is secured and has reasons', () => {
    const { getByText } = renderComponent({
      feature: { ...mockFeature, secured: true, security_reasons: ['Moose', 'Spotted Owl'] }
    });

    expect(getByText('This feature is secured')).toBeInTheDocument();
    expect(getByText(/for the following reasons/i)).toHaveTextContent('Moose, Spotted Owl');
  });

  it('renders the secured banner without a reasons sentence when there are no reasons', () => {
    const { getByText, queryByText } = renderComponent({
      feature: { ...mockFeature, secured: true, security_reasons: [] }
    });

    expect(getByText('This feature is secured')).toBeInTheDocument();
    expect(queryByText(/for the following reasons/i)).toBeNull();
  });

  it('does not render the secured banner when the feature is not secured', () => {
    const { queryByText } = renderComponent({ feature: { ...mockFeature, secured: false } });

    expect(queryByText(/This feature is secured/i)).toBeNull();
  });

  it('renders a single reason without a stray trailing comma', () => {
    const { getByText } = renderComponent({
      feature: { ...mockFeature, secured: true, security_reasons: ['Moose'] }
    });

    const reasons = getByText(/for the following reasons/i);
    expect(reasons).toHaveTextContent('Moose');
    expect(reasons).not.toHaveTextContent('Moose,');
  });

  it('renders the no-data fallback and no banner when there is no feature', () => {
    const { getByText, queryByText } = renderComponent({ feature: undefined });

    expect(getByText('No data available')).toBeInTheDocument();
    expect(queryByText(/This feature is secured/i)).toBeNull();
  });
});
