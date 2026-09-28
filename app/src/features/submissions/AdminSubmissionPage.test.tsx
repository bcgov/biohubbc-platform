import { render, screen } from '@testing-library/react';
import { AdminSubmissionPage } from './AdminSubmissionPage';

vi.mock('hooks/useContext', () => ({
  useSubmissionContext: () => ({
    submissionDataLoader: { data: { submission_id: 7, name: 'Submission seven' } },
    featureDataLoader: {
      data: {
        features: [{ submission_feature_id: 42, feature_type_name: 'survey', secured: true }],
        pagination: { total: 1 }
      }
    },
    paginationModel: { page: 0, pageSize: 10 },
    setPaginationModel: vi.fn(),
    sortModel: [],
    setSortModel: vi.fn()
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
      {props.columns.find((column: any) => column.field === 'secured').renderCell({ row: props.rows[0] })}
      {props.checkboxSelection && <input type="checkbox" aria-label="Select feature" />}
    </div>
  )
}));

describe('AdminSubmissionPage', () => {
  it('keeps feature security and upload navigation visible without legacy security actions', () => {
    render(<AdminSubmissionPage />);
    expect(screen.getByText('Submission seven')).toBeVisible();
    expect(screen.getByLabelText('Secured')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload reviews' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /security|publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
