import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen } from 'test-helpers/test-utils';
import { AdminSubmissionPage } from './AdminSubmissionPage';

const mocks = vi.hoisted(() => ({ getSubmission: vi.fn(), getFeatures: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    submissions: { getSubmissionRecordWithSecurity: mocks.getSubmission },
    admin: { getSubmissionFeatures: mocks.getFeatures }
  })
}));
vi.mock('./components/SubmissionHeaderSecurityStatus', () => ({ default: () => <span>Security status</span> }));
vi.mock('./page/status/SubmissionUploadStatus', () => ({
  SubmissionUploadStatus: () => <a href="/admin/submissions/7/uploads">Upload reviews</a>
}));

// Expose any selection or mutation handlers supplied to the shared grid.
vi.mock('components/data-grid/CustomDataGrid', () => ({
  default: (props: any) => (
    <div>
      {props.rows[0] &&
        props.columns.find((column: any) => column.field === 'secured').renderCell({ row: props.rows[0] })}
      {props.checkboxSelection && <input type="checkbox" aria-label="Select feature" />}
    </div>
  )
}));

/**
 * Renders the page at a submission route.
 *
 * @param {string} path The route to open.
 * @returns The RTL render result.
 */
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/submissions/:submission_id" element={<AdminSubmissionPage />} />
        <Route path="/page-not-found" element={<div>Not found</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminSubmissionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSubmission.mockResolvedValue({ submission_id: 7, name: 'Submission seven' });
    mocks.getFeatures.mockResolvedValue({
      features: [{ submission_feature_id: 42, feature_type_name: 'survey', secured: true }],
      pagination: { total: 1 }
    });
  });

  it('keeps feature security and upload navigation visible without legacy security actions', async () => {
    renderAt('/admin/submissions/7');

    expect(await screen.findByText('Submission seven')).toBeVisible();
    expect(await screen.findByLabelText('Secured')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload reviews' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /security|publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(mocks.getFeatures).toHaveBeenCalledWith(
      7,
      { page: 1, limit: 10, sort: 'submission_feature_id', order: 'asc' },
      { signal: expect.any(AbortSignal) }
    );
  });

  it('redirects when the route does not identify a submission', () => {
    renderAt('/admin/submissions/not-a-number');

    expect(screen.getByText('Not found')).toBeVisible();
    expect(mocks.getSubmission).not.toHaveBeenCalled();
  });
});
