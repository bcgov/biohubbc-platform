import { fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { SubmissionDetailPage } from './SubmissionDetailPage';

vi.mock('../../hooks/useApi');

const mockUseApi = useApi as Mock;
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockGetSubmissionRecordWithSecurity = vi.fn();
const mockGetSubmissionFeatures = vi.fn();

const mockSubmission = {
  submission_id: 1,
  uuid: 'uuid-1',
  security_review_timestamp: null,
  publish_timestamp: null,
  submitted_timestamp: null,
  source_system: 'SIMS',
  name: 'Test Submission',
  description: 'A test submission',
  comment: null,
  create_date: '2026-01-01T00:00:00.000Z',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  security: 'UNSECURED'
};

const mockFeaturesResponse = {
  features: [
    {
      submission_feature_id: 10,
      uuid: 'feat-uuid-1',
      submission_id: 1,
      feature_type_id: 100,
      feature_type_name: 'Observation',
      secured: false,
      submission_feature_security_ids: []
    },
    {
      submission_feature_id: 20,
      uuid: 'feat-uuid-2',
      submission_id: 1,
      feature_type_id: 101,
      feature_type_name: 'Survey',
      secured: false,
      submission_feature_security_ids: []
    }
  ],
  pagination: { total: 2, current_page: 1, last_page: 1, per_page: 10 }
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/submission/1']}>
      <Routes>
        <Route path="/submission/:submissionId" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('SubmissionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      submissions: {
        getSubmissionRecordWithSecurity: mockGetSubmissionRecordWithSecurity,
        getSubmissionFeatures: mockGetSubmissionFeatures
      }
    });

    mockGetSubmissionRecordWithSecurity.mockResolvedValue(mockSubmission);
    mockGetSubmissionFeatures.mockResolvedValue(mockFeaturesResponse);
  });

  it('renders submission feature rows', async () => {
    const { findByText } = renderPage();

    expect(await findByText('Observation')).toBeVisible();
    expect(await findByText('Survey')).toBeVisible();
  });

  it('renders AlertBanner when there are secured features', async () => {
    mockGetSubmissionFeatures.mockResolvedValue({
      ...mockFeaturesResponse,
      features: [
        ...mockFeaturesResponse.features,
        {
          submission_feature_id: 30,
          uuid: 'feat-uuid-3',
          submission_id: 1,
          feature_type_id: 102,
          feature_type_name: 'Secured Feature',
          secured: true,
          submission_feature_security_ids: [1]
        }
      ],
      pagination: { total: 3, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { findByText } = renderPage();

    expect(await findByText('This submission contains secured features that are not displayed.')).toBeVisible();
  });

  it('navigates to feature page when a row is clicked', async () => {
    const { findByText } = renderPage();

    const row = await findByText('Observation');
    fireEvent.click(row.closest('.MuiDataGrid-row')!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/submission/1/feature/10');
    });
  });
});
