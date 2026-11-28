import { fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PortalSubmissionUploadPage } from './PortalSubmissionUploadPage';

vi.mock('hooks/useApi');

const mockUseApi = useApi as Mock;
const mockGetSubmissionRecordWithSecurity = vi.fn();
const mockGetSubmissionUploadFeatures = vi.fn();
const mockGetSubmissionUpload = vi.fn();

const submissionUploadId = '11111111-1111-4111-8111-111111111111';

const renderPage = (initialPath = `/portal/submission/1/upload/${submissionUploadId}`) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/portal/submission/:submissionId/upload/:submissionUploadId"
          element={<PortalSubmissionUploadPage />}
        />
        <Route path="/portal/submission/:submissionId/feature/:submissionFeatureId" element={<div>Feature page</div>} />
        <Route path="/page-not-found" element={<div>Page Not Found</div>} />
        <Route path="/forbidden" element={<div>Forbidden</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('PortalSubmissionUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApi.mockReturnValue({
      submissions: {
        getSubmissionRecordWithSecurity: mockGetSubmissionRecordWithSecurity,
        getSubmissionUploadFeatures: mockGetSubmissionUploadFeatures,
        getSubmissionUpload: mockGetSubmissionUpload
      }
    });

    mockGetSubmissionRecordWithSecurity.mockResolvedValue({
      submission_id: 1,
      uuid: 'uuid-1',
      name: 'Test Submission'
    });
    mockGetSubmissionUpload.mockResolvedValue({
      submission_upload_id: submissionUploadId,
      status: 'indexed',
      decision: 'pending',
      create_date: '2026-11-27T12:00:00.000Z'
    });
    mockGetSubmissionUploadFeatures.mockResolvedValue({
      features: [{ submission_id: 1, submission_feature_id: 20, feature_type_id: 3, feature_type_name: 'Observation' }],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  it("lists the upload's features through the submission's upload endpoint", async () => {
    const { findByText } = renderPage();

    expect(await findByText('Observation')).toBeVisible();
    expect(mockGetSubmissionUploadFeatures).toHaveBeenCalledWith(1, submissionUploadId, expect.any(Object), {
      signal: expect.any(AbortSignal)
    });
  });

  it("links back to the submission's Uploads tab", async () => {
    const { findByRole } = renderPage();

    expect(await findByRole('link', { name: 'Test Submission' })).toHaveAttribute(
      'href',
      '/portal/submission/1?tab=uploads'
    );
  });

  it("opens a feature's Portal page when its row is selected", async () => {
    const { findByText } = renderPage();

    const row = await findByText('Observation');
    fireEvent.click(row.closest('.MuiDataGrid-row')!);

    await waitFor(() => expect(document.body).toHaveTextContent('Feature page'));
  });

  it("sends a caller outside the submission's team to the forbidden page", async () => {
    mockGetSubmissionUploadFeatures.mockRejectedValue({ status: 403, message: 'Access Denied' });

    const { findByText } = renderPage();

    expect(await findByText('Forbidden')).toBeVisible();
  });

  it('shows not found when the upload is not in the submission', async () => {
    mockGetSubmissionUploadFeatures.mockRejectedValue({ status: 404, message: 'Submission upload not found' });

    const { findByText } = renderPage();

    expect(await findByText('Page Not Found')).toBeVisible();
  });

  it('shows the Features tab by default', async () => {
    const { findByText, getByRole } = renderPage();

    expect(await findByText('Observation')).toBeVisible();
    expect(getByRole('tab', { name: 'Features' })).toHaveAttribute('aria-selected', 'true');
  });

  it("lists the upload's metadata on the About tab, read by the submission's UUID", async () => {
    const { findByText, getByRole, queryByText } = renderPage(
      `/portal/submission/1/upload/${submissionUploadId}?tab=about`
    );

    expect(await findByText('Uploaded')).toBeVisible();
    expect(getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true');
    expect(await findByText('Decision')).toBeVisible();
    expect(queryByText('Observation')).not.toBeInTheDocument();
    expect(mockGetSubmissionUpload).toHaveBeenCalledWith('uuid-1', submissionUploadId, {
      signal: expect.any(AbortSignal)
    });
  });
});
