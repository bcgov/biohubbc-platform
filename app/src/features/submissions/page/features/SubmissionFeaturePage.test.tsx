import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { SubmissionFeaturePage } from './SubmissionFeaturePage';

vi.mock('../../../../hooks/useApi');

const mockUseApi = useApi as Mock;

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
  data: { species_name: 'Wolf', count: '5' },
  secured: false,
  security_reasons: []
};

const renderPage = (initialPath = '/submission/1/feature/10') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/submission/:submissionId/feature/:submissionFeatureId" element={<SubmissionFeaturePage />} />
        <Route path="/page-not-found" element={<div>Page Not Found</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('SubmissionFeaturePage', () => {
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
        { id: 'string:1', property: 'species name', value: 'Wolf' },
        { id: 'number:1', property: 'count', value: '5' },
        {
          id: 'taxon:1',
          property: 'focal species',
          value: { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' }
        }
      ],
      pagination: { total: 3, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  it('renders the indexed feature property rows', async () => {
    const { findByText } = renderPage();

    expect(await findByText('Properties')).toBeVisible();
    expect(await findByText('Wolf')).toBeVisible();
    expect(await findByText('5')).toBeVisible();
    expect(mockGetSubmissionFeatureProperties).toHaveBeenCalledWith(1, 10, expect.any(Object));
  });

  it('renders Details as the selected tab', async () => {
    const { findByRole } = renderPage();

    expect(await findByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('links taxon property values to the taxon page under the submission', async () => {
    const { findByRole } = renderPage('/submission/1/feature/10?view=table');

    expect(await findByRole('link', { name: 'Ursus americanus' })).toHaveAttribute(
      'href',
      '/submission/1/taxon/180543?view=table'
    );
  });

  it('redirects to the not found page when a route param is not a record id', async () => {
    const { findByText } = renderPage('/submission/abc/feature/10');

    expect(await findByText('Page Not Found')).toBeVisible();
    expect(mockGetSubmissionFeatureById).not.toHaveBeenCalled();
  });

  it('renders the no-data fallback when the API returns no feature', async () => {
    mockGetSubmissionFeatureById.mockResolvedValueOnce({ feature: undefined });

    const { findByText } = renderPage();

    expect(await findByText('No data available')).toBeVisible();
  });

  it('renders the feature skeleton while the feature is loading', async () => {
    mockGetSubmissionFeatureById.mockReturnValueOnce(new Promise(() => undefined));

    const { findByTestId } = renderPage();

    expect(await findByTestId('feature-skeleton')).toBeVisible();
  });

  it('renders Secured chip when feature is secured', async () => {
    mockGetSubmissionFeatureById.mockResolvedValue({
      feature: { ...mockFeature, secured: true }
    });

    const { findByText } = renderPage();

    expect(await findByText('Secured')).toBeVisible();
  });
});
