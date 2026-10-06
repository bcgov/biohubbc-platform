import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { AdminSubmissionPage } from './AdminSubmissionPage';

const mocks = vi.hoisted(() => ({ getSubmission: vi.fn(), listUploads: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    submissions: { getSubmissionRecordWithSecurity: mocks.getSubmission, listAdminSubmissionUploads: mocks.listUploads }
  })
}));

const upload = {
  submission_upload_id: '22222222-2222-4222-8222-222222222222',
  upload_id: '33333333-3333-4333-8333-333333333333',
  ticket_id: '44444444-4444-4444-8444-444444444444',
  status: 'indexed',
  decision: 'pending',
  comment: 'Updated observations',
  create_date: '2026-10-01T12:00:00Z',
  create_user: 42,
  submitted_by_identifier: 'admin@example.com'
};

/**
 * Render the admin submission route with its real header, tabs and grids.
 *
 * @param {string} path Route to open.
 * @returns The RTL render result.
 */
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/submissions/:submission_id" element={<AdminSubmissionPage />} />
        <Route
          path={`/admin/submissions/7/uploads/${upload.submission_upload_id}`}
          element={<div>Upload details</div>}
        />
        <Route path="/page-not-found" element={<div>Not found</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminSubmissionPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSubmission.mockResolvedValue({
      submission_id: 7,
      name: 'Submission seven',
      description: 'A submission description',
      uuid: '11111111-1111-4111-8111-111111111111',
      contributor_id: 5,
      contributor_name: 'SIMS',
      create_date: '2026-09-01T12:00:00Z',
      create_user: 42,
      update_date: null,
      update_user: null,
      revision_count: 0,
      submitted_timestamp: '2026-09-01T12:00:00Z',
      security_review_timestamp: null,
      publish_timestamp: null
    });
    mocks.listUploads.mockResolvedValue({ uploads: [upload], pagination: { total: 11 } });
  });

  it('shows scoped uploads by default and navigates to the clicked upload', async () => {
    renderAt('/admin/submissions/7');
    expect(await screen.findByRole('heading', { name: 'Submission seven' })).toBeVisible();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Uploads', 'Metadata']);
    expect(screen.getByRole('tab', { name: 'Uploads' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Updated observations')).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Ticket' })).not.toBeInTheDocument();
    expect(mocks.listUploads).toHaveBeenCalledWith(
      7,
      { page: 1, limit: 10, sort: 'create_date', order: 'desc' },
      { signal: expect.any(AbortSignal) }
    );
    fireEvent.click(screen.getByText('Updated observations'));
    expect(await screen.findByText('Upload details')).toBeVisible();
  });

  it('keeps pagination when switching to metadata and back', async () => {
    renderAt('/admin/submissions/7');
    await screen.findByText('Updated observations');
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(mocks.listUploads).toHaveBeenLastCalledWith(
        7,
        { page: 2, limit: 10, sort: 'create_date', order: 'desc' },
        { signal: expect.any(AbortSignal) }
      )
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Metadata' }));
    const metadata = within(screen.getByRole('tabpanel', { name: 'Metadata' }));
    expect(metadata.getByRole('row', { name: 'create_user 42' })).toBeVisible();
    expect(metadata.getByRole('row', { name: 'create_date 2026-09-01T12:00:00Z' })).toBeVisible();
    expect(metadata.getByRole('row', { name: 'contributor_name SIMS' })).toBeVisible();
    expect(metadata.getAllByRole('row')).toHaveLength(6);
    expect(metadata.queryByText('contributor_id')).not.toBeInTheDocument();
    expect(metadata.queryByText('update_date')).not.toBeInTheDocument();
    expect(metadata.queryByText('update_user')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Uploads' }));
    expect(screen.getByText('11–11 of 11')).toBeVisible();
    expect(mocks.listUploads).toHaveBeenCalledTimes(2);
  });

  it('supports opening the metadata tab directly', async () => {
    renderAt('/admin/submissions/7?tab=metadata');
    expect(await screen.findByRole('tabpanel', { name: 'Metadata' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Metadata' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sorts uploads on the server', async () => {
    renderAt('/admin/submissions/7');
    await screen.findByText('Updated observations');
    fireEvent.click(screen.getByRole('columnheader', { name: /Status/ }));
    await waitFor(() =>
      expect(mocks.listUploads).toHaveBeenLastCalledWith(
        7,
        { page: 1, limit: 10, sort: 'status', order: 'asc' },
        { signal: expect.any(AbortSignal) }
      )
    );
  });

  it('preserves the requested page without an error banner after a pagination failure', async () => {
    renderAt('/admin/submissions/7');
    await screen.findByText('Updated observations');
    mocks.listUploads.mockRejectedValueOnce(new Error('Unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() => expect(screen.queryByText('Updated observations')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('11–11 of 11')).toBeVisible();
    expect(mocks.listUploads).toHaveBeenLastCalledWith(
      7,
      { page: 2, limit: 10, sort: 'create_date', order: 'desc' },
      { signal: expect.any(AbortSignal) }
    );
  });

  it('shows an empty uploads state', async () => {
    mocks.listUploads.mockResolvedValue({ uploads: [], pagination: { total: 0 } });
    renderAt('/admin/submissions/7');
    expect(await screen.findByText('No uploads found.')).toBeVisible();
  });

  it('does not show an error banner when uploads fail to load', async () => {
    mocks.listUploads.mockRejectedValueOnce(new Error('Unavailable'));
    renderAt('/admin/submissions/7');
    expect(await screen.findByText('No uploads found.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show an error banner or request uploads when the submission fails to load', async () => {
    mocks.getSubmission.mockRejectedValue(new Error('Missing'));
    renderAt('/admin/submissions/7');
    expect(await screen.findByRole('heading', { name: 'Submission' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.listUploads).not.toHaveBeenCalled();
  });

  it('redirects invalid identifiers without fetching', () => {
    renderAt('/admin/submissions/not-a-number');
    expect(screen.getByText('Not found')).toBeVisible();
    expect(mocks.getSubmission).not.toHaveBeenCalled();
    expect(mocks.listUploads).not.toHaveBeenCalled();
  });
});
