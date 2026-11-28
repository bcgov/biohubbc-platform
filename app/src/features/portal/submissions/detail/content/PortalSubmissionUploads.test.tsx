import { fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { PortalSubmissionUploads } from './PortalSubmissionUploads';

vi.mock('hooks/useApi');

const mockUseApi = useApi as Mock;
const mockListSubmissionUploads = vi.fn();

const upload = {
  submission_upload_id: '11111111-1111-4111-8111-111111111111',
  status: 'uploaded' as const,
  decision: 'pending' as const,
  create_date: '2026-01-02T12:00:00.000Z'
};

const renderUploads = () =>
  render(
    <MemoryRouter initialEntries={['/portal/submission/7']}>
      <Routes>
        <Route
          path="/portal/submission/:submissionId"
          element={<PortalSubmissionUploads submissionId={7} submissionUuid="submission-uuid" />}
        />
        <Route path="/portal/submission/:submissionId/upload/:submissionUploadId" element={<div>Upload page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('PortalSubmissionUploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({ submissions: { listSubmissionUploads: mockListSubmissionUploads } });
    mockListSubmissionUploads.mockResolvedValue({
      uploads: [upload],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  it("lists the submission's uploads, newest first, through the submission UUID", async () => {
    const { findByText, getByText } = renderUploads();

    expect(await findByText('11111111-1111-4111-8111-111111111111')).toBeVisible();
    expect(getByText('(1)')).toBeVisible();
    expect(mockListSubmissionUploads).toHaveBeenCalledWith(
      'submission-uuid',
      expect.objectContaining({ page: 1, sort: 'create_date', order: 'desc' }),
      { signal: expect.any(AbortSignal) }
    );
  });

  it('opens the Portal upload page when an upload is selected', async () => {
    const { findByText } = renderUploads();

    fireEvent.click(await findByText('11111111-1111-4111-8111-111111111111'));

    expect(await findByText('Upload page')).toBeVisible();
  });

  it('shows an empty message when the submission has no uploads', async () => {
    mockListSubmissionUploads.mockResolvedValue({
      uploads: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { findByText } = renderUploads();

    expect(await findByText('No uploads found.')).toBeVisible();
  });
});
