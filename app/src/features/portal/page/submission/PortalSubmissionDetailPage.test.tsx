import { QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { act, fireEvent, waitFor, within } from '@testing-library/react';
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

const renderPage = (queryClient?: QueryClient) =>
  render(
    <MemoryRouter initialEntries={['/portal/submission/1']}>
      <Routes>
        <Route path="/portal/submission/:submissionId" element={<PortalSubmissionDetailPage />} />
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
        getSubmissionFeatures: mockGetSubmissionFeatures
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
});
