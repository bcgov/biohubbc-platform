import { useApi } from 'hooks/useApi';
import { fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PortalSubmissionFeaturePage } from './PortalSubmissionFeaturePage';

vi.mock('../../../../hooks/useApi');

const mockUseApi = useApi as Mock;
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockGetSubmissionFeatureById = vi.fn();
const mockGetSubmissionFeatureProperties = vi.fn();

const mockFeature = {
  submission_feature_id: 10,
  uuid: 'feat-uuid-1',
  urn: 'urn:test:1',
  submission_id: 1,
  feature_type_id: 100,
  feature_type_name: 'observation',
  feature_type_display_name: 'Observation',
  submission_name: 'Test Submission',
  source_id: null,
  data: { species_name: 'Wolf' },
  secured: false
};

const mockRelatedFeatures = [
  {
    submission_feature_id: 20,
    feature_type_name: 'survey',
    feature_type_display_name: 'Survey',
    data: { name: 'Related Survey' }
  }
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/portal/submission/1/feature/10']}>
      <Routes>
        <Route
          path="/portal/submission/:submissionId/feature/:submissionFeatureId"
          element={<PortalSubmissionFeaturePage />}
        />
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
      feature: mockFeature,
      relatedFeatures: mockRelatedFeatures
    });

    mockGetSubmissionFeatureProperties.mockResolvedValue({
      properties: [{ id: 'species_name', property: 'species name', value: 'Wolf' }],
      pagination: {
        total: 1,
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
      expect(mockGetSubmissionFeatureProperties).toHaveBeenCalledWith('1', '10', expect.any(Object));
    });
  });

  it('uses portal route for related feature links', async () => {
    const { findByText } = renderPage();

    const relatedRowText = await findByText('Related Survey');
    fireEvent.click(relatedRowText.closest('.MuiDataGrid-row')!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/portal/submission/1/feature/20');
    });
  });

  it('renders portal as the breadcrumb root', async () => {
    const { findByRole } = renderPage();

    expect(await findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/portal/submission');
  });
});
