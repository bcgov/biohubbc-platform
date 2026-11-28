import { QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { act, waitFor, within } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PortalSubmissionDetailPage } from './PortalSubmissionDetailPage';

vi.mock('hooks/useApi');

// The Features section is the shared searchable one, covered by its own tests; here it reports what it was given.
vi.mock('features/submissions/components/SubmissionFeatures', () => ({
  SubmissionFeatures: ({
    submissionId,
    basePath,
    featureTypes
  }: {
    submissionId: number;
    basePath: string;
    featureTypes: string[];
  }) => <section data-testid="submission-features">{`${submissionId} ${basePath} ${featureTypes.join(',')}`}</section>
}));

const mockUseApi = useApi as Mock;
const mockGetSubmissionRecordWithSecurity = vi.fn();

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
  security: 'UNSECURED' as const,
  feature_types: ['survey', 'animal']
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
      submissions: { getSubmissionRecordWithSecurity: mockGetSubmissionRecordWithSecurity }
    });
    mockGetSubmissionRecordWithSecurity.mockResolvedValue(mockSubmission);
  });

  it("shows the submission's searchable features, opening results under the portal", async () => {
    const { findByTestId } = renderPage();

    expect(await findByTestId('submission-features')).toHaveTextContent('1 /portal/submission survey,animal');
  });

  it('keeps the Features section mounted during a background refresh', async () => {
    const queryClient = createTestQueryClient();
    const { findByTestId, findByText, getByTestId } = renderPage(queryClient);
    const originalFeatures = await findByTestId('submission-features');
    let finishRefresh!: (value: typeof mockSubmission) => void;
    mockGetSubmissionRecordWithSecurity.mockReturnValueOnce(
      new Promise<typeof mockSubmission>((resolve) => (finishRefresh = resolve))
    );
    let refresh!: Promise<void>;
    act(() => {
      refresh = queryClient.invalidateQueries({ queryKey: submissionQueryKeys.record(1) });
    });
    await waitFor(() => expect(mockGetSubmissionRecordWithSecurity).toHaveBeenCalledTimes(2));
    expect(getByTestId('submission-features')).toBe(originalFeatures);
    await act(async () => {
      finishRefresh({ ...mockSubmission, name: 'Updated Submission' });
      await refresh;
    });
    expect(await findByText('Updated Submission', { selector: 'h1' })).toBeVisible();
    expect(getByTestId('submission-features')).toBe(originalFeatures);
  });

  it('notes secured features only when the submission has some', async () => {
    mockGetSubmissionRecordWithSecurity.mockResolvedValue({ ...mockSubmission, security: 'SECURED' });
    const { findByText } = renderPage();

    expect(await findByText('This submission contains secured features.')).toBeVisible();
  });

  it('does not note secured features for an unsecured submission', async () => {
    const { findByTestId, queryByText } = renderPage();

    await findByTestId('submission-features');

    expect(queryByText('This submission contains secured features.')).not.toBeInTheDocument();
  });

  it('renders portal breadcrumbs with submission name', async () => {
    const { findByRole } = renderPage();
    const breadcrumbNav = await findByRole('navigation', { name: 'breadcrumb' });

    expect(await findByRole('link', { name: 'Submissions' })).toHaveAttribute('href', '/portal/submission');
    expect(await findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/portal');
    expect(within(breadcrumbNav).getByText('Test Submission')).toBeVisible();
  });
});
