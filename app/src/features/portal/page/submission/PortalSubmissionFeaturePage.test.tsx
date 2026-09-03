import { useApi } from 'hooks/useApi';
import { waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PortalSubmissionFeaturePage } from './PortalSubmissionFeaturePage';

vi.mock('../../../../hooks/useApi');

const mockUseApi = useApi as Mock;

// The map owns its own data loading and is covered by its own suite; this one is about the page layout.
vi.mock('features/submissions/page/features/components/map/SubmissionFeatureMap', () => ({
  SubmissionFeatureMap: (props: { submissionId: number; submissionFeatureId: number }) => (
    <div data-testid="submission-feature-map-stub" data-props={JSON.stringify(props)} />
  )
}));

const mockGetSubmissionFeatureById = vi.fn();
const mockGetSubmissionFeatureProperties = vi.fn();

const mockFeature = {
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
  data: { species_name: 'Wolf' },
  secured: false
};

const renderPage = (initialPath = '/portal/submission/1/feature/10') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/portal/submission/:submissionId/feature/:submissionFeatureId"
          element={<PortalSubmissionFeaturePage />}
        />
        <Route path="/page-not-found" element={<div>Page Not Found</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('PortalSubmissionFeaturePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApi.mockReturnValue({
      features: {
        getSubmissionFeatureById: mockGetSubmissionFeatureById,
        getSubmissionFeatureProperties: mockGetSubmissionFeatureProperties
      }
    });

    mockGetSubmissionFeatureById.mockResolvedValue({
      feature: mockFeature
    });

    mockGetSubmissionFeatureProperties.mockResolvedValue({
      properties: [
        { id: 'species_name', property: 'species name', value: 'Wolf' },
        {
          id: 'taxon:1',
          property: 'focal species',
          value: { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' }
        }
      ],
      pagination: {
        total: 2,
        current_page: 1,
        last_page: 1,
        per_page: 10
      }
    });
  });

  it('renders feature properties', async () => {
    const { findByText } = renderPage();

    expect(await findByText('Properties')).toBeVisible();
    await waitFor(() => {
      expect(mockGetSubmissionFeatureProperties).toHaveBeenCalledWith(1, 10, expect.any(Object));
    });
    expect(await findByText('Wolf')).toBeVisible();
  });

  it('links taxon property values to the portal taxon route', async () => {
    const { findByRole } = renderPage();

    expect(await findByRole('link', { name: 'Ursus americanus' })).toHaveAttribute(
      'href',
      '/portal/submission/1/taxon/180543'
    );
  });

  it('redirects to the not found page when a route param is not a record id', async () => {
    const { findByText } = renderPage('/portal/submission/abc/feature/10');

    expect(await findByText('Page Not Found')).toBeVisible();
    expect(mockGetSubmissionFeatureById).not.toHaveBeenCalled();
  });

  it('renders portal as the breadcrumb root', async () => {
    const { findByRole } = renderPage();

    expect(await findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/portal/submission');
  });

  it('places Map and About after Properties', async () => {
    const { findByText, getAllByRole } = renderPage();
    await findByText('Properties');

    const sectionLabels = getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

    expect(sectionLabels).toEqual(['Properties', 'Map', 'About']);
  });

  it('renders feature metadata in the About section', async () => {
    const { findByText } = renderPage();

    expect(await findByText('January 2, 2026')).toBeVisible();
    expect(await findByText('SIMS')).toBeVisible();
    expect(await findByText('feat-uuid-1')).toBeVisible();
  });

  it('maps the feature being viewed', async () => {
    const { findByTestId } = renderPage();

    const stub = await findByTestId('submission-feature-map-stub');

    expect(JSON.parse(stub.dataset.props ?? '{}')).toEqual({
      submissionId: mockFeature.submission_id,
      submissionFeatureId: mockFeature.submission_feature_id
    });
  });
});
