import { fireEvent, waitFor, within } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PortalSubmissionDetailPage } from './PortalSubmissionDetailPage';

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

const mockGetSubmissionRecordWithSecurity = vi.fn();
const mockGetSubmissionFeatures = vi.fn();

const mockSubmission = {
  submission_id: 1,
  uuid: 'uuid-1',
  security_review_timestamp: null,
  publish_timestamp: null,
  submitted_timestamp: '2026-01-01T00:00:00.000Z',
  contributor_id: 2,
  name: 'Test Submission',
  description: 'A test submission',
  comment: '',
  create_date: '2026-01-01T00:00:00.000Z',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  security: 'UNSECURED' as const
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
    }
  ],
  pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/portal/submission/1']}>
      <Routes>
        <Route path="/portal/submission/:submissionId" element={<PortalSubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('PortalSubmissionDetailPage', () => {
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

  it('renders feature rows', async () => {
    const { findByText } = renderPage();

    expect(await findByText('Observation')).toBeVisible();
  });

  it('renders portal breadcrumbs with submission name', async () => {
    const { findByRole } = renderPage();
    const breadcrumbNav = await findByRole('navigation', { name: 'breadcrumb' });

    expect(await findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/portal/submission');
    expect(within(breadcrumbNav).getByText('Test Submission')).toBeVisible();
  });

  it('navigates to portal feature page when row is clicked', async () => {
    const { findByText } = renderPage();

    const row = await findByText('Observation');
    fireEvent.click(row.closest('.MuiDataGrid-row')!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/portal/submission/1/feature/10');
    });
  });

  it('searches features server-side by name', async () => {
    const { findByPlaceholderText } = renderPage();

    const searchInput = await findByPlaceholderText('Search by feature name');
    fireEvent.change(searchInput, { target: { value: 'obs' } });

    await waitFor(() => {
      expect(mockGetSubmissionFeatures).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({
          search: 'obs'
        })
      );
    });
  });
});
