import { QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PortalSubmissionDetailPage } from './PortalSubmissionDetailPage';

vi.mock('hooks/useApi');

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
const mockListSubmissionUploads = vi.fn();

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

const renderPage = (queryClient?: QueryClient, initialPath = '/portal/submission/1') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/portal/submission/:submissionId" element={<PortalSubmissionDetailPage />} />
        <Route path="/forbidden" element={<div>Forbidden</div>} />
      </Routes>
    </MemoryRouter>,
    { queryClient }
  );

describe('PortalSubmissionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      submissions: {
        getSubmissionRecordWithSecurity: mockGetSubmissionRecordWithSecurity,
        getSubmissionFeatures: mockGetSubmissionFeatures,
        listSubmissionUploads: mockListSubmissionUploads
      }
    });

    mockGetSubmissionRecordWithSecurity.mockResolvedValue(mockSubmission);
    mockGetSubmissionFeatures.mockResolvedValue(mockFeaturesResponse);
  });

  it('keeps the existing submission and feature table mounted during background refresh', async () => {
    const queryClient = createTestQueryClient();
    const { findByText, getByRole } = renderPage(queryClient);
    const originalRow = await findByText('Observation');
    const originalTable = getByRole('grid');
    let finishRefresh!: (value: typeof mockSubmission) => void;
    mockGetSubmissionRecordWithSecurity.mockReturnValueOnce(
      new Promise<typeof mockSubmission>((resolve) => (finishRefresh = resolve))
    );
    let refresh!: Promise<void>;
    act(() => {
      refresh = queryClient.invalidateQueries({ queryKey: submissionQueryKeys.record(1) });
    });
    await waitFor(() => expect(mockGetSubmissionRecordWithSecurity).toHaveBeenCalledTimes(2));
    expect(originalRow).toBeVisible();
    expect(getByRole('grid')).toBe(originalTable);
    await act(async () => {
      finishRefresh({ ...mockSubmission, name: 'Updated Submission' });
      await refresh;
    });
    expect(await findByText('Updated Submission', { selector: 'h1' })).toBeVisible();
    expect(getByRole('grid')).toBe(originalTable);
  });

  it('renders feature rows', async () => {
    const { findByText } = renderPage();

    expect(await findByText('Observation')).toBeVisible();
  });

  it('renders portal breadcrumbs with submission name', async () => {
    const { findByRole } = renderPage();
    const breadcrumbNav = await findByRole('navigation', { name: 'breadcrumb' });

    expect(await findByRole('link', { name: 'Submissions' })).toHaveAttribute('href', '/portal/submission');
    expect(await findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/portal');
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

  it("sends a caller outside the submission's team to the forbidden page", async () => {
    mockGetSubmissionRecordWithSecurity.mockRejectedValue({ status: 403, message: 'Access Denied' });
    mockGetSubmissionFeatures.mockRejectedValue({ status: 403, message: 'Access Denied' });

    const { findByText, queryByText } = renderPage();

    expect(await findByText('Forbidden')).toBeVisible();
    expect(queryByText('Test Submission')).not.toBeInTheDocument();
  });

  it('shows the Features tab by default, without loading uploads', async () => {
    const { findByText, getByRole } = renderPage();

    expect(await findByText('Observation')).toBeVisible();
    expect(getByRole('tab', { name: 'Features' })).toHaveAttribute('aria-selected', 'true');
    expect(mockListSubmissionUploads).not.toHaveBeenCalled();
  });

  it("lists the submission's uploads on the Uploads tab, addressed by the submission's UUID", async () => {
    mockListSubmissionUploads.mockResolvedValue({
      uploads: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { findByText, getByRole } = renderPage(undefined, '/portal/submission/1?tab=uploads');

    expect(await findByText('No uploads found.')).toBeVisible();
    expect(getByRole('tab', { name: 'Uploads' })).toHaveAttribute('aria-selected', 'true');
    expect(mockListSubmissionUploads).toHaveBeenCalledWith('uuid-1', expect.any(Object), {
      signal: expect.any(AbortSignal)
    });
  });

  it('shows no chips in the header, only the description', async () => {
    const { findByText, queryByText } = renderPage();

    expect(await findByText('A test submission')).toBeVisible();
    expect(queryByText(/^Submitted/)).not.toBeInTheDocument();
    expect(queryByText('Unsecured')).not.toBeInTheDocument();
  });

  it('shows the secured banner without an access request when some features are secured', async () => {
    mockGetSubmissionRecordWithSecurity.mockResolvedValue({ ...mockSubmission, security: 'PARTIALLY SECURED' });

    const { findByText, queryByRole } = renderPage();

    expect(await findByText('Some features are secured')).toBeVisible();
    expect(queryByRole('button', { name: 'Request Access' })).not.toBeInTheDocument();
  });

  it('shows no secured banner when no features are secured', async () => {
    const { findByText, queryByText } = renderPage();

    await findByText('Observation');

    expect(queryByText('Some features are secured')).not.toBeInTheDocument();
  });

  it("lists the submission's metadata on the About tab", async () => {
    mockGetSubmissionRecordWithSecurity.mockResolvedValue({
      ...mockSubmission,
      contributor_name: 'SIMS',
      last_approved_upload_date: null
    });

    const { findByText, getByRole } = renderPage(undefined, '/portal/submission/1?tab=about');

    expect(await findByText('Submitted')).toBeVisible();
    expect(getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true');
    expect(await findByText('SIMS')).toBeVisible();
    expect(await findByText('uuid-1')).toBeVisible();
  });
});
