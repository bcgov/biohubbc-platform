import { cleanup, fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminSubmissionsPage } from './AdminSubmissionsPage';

vi.mock('hooks/useApi');

const mockUseApi = {
  submissions: {
    getAdminSubmissionList: vi.fn(),
    getAdminSubmissionUploadList: vi.fn()
  }
};

const SubmissionRoute = () => {
  const { submissionId } = useParams();
  return <div data-testid="submission-page">{submissionId}</div>;
};

const SubmissionUploadRoute = () => {
  const { submissionId, submissionUploadId } = useParams();
  return <div data-testid="submission-upload-page">{`${submissionId}/${submissionUploadId}`}</div>;
};

const renderContainer = (route: string) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
        <Route path="/admin/submissions/:submissionId" element={<SubmissionRoute />} />
        <Route
          path="/admin/submissions/:submissionId/uploads/:submissionUploadId"
          element={<SubmissionUploadRoute />}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminSubmissionsPage', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.submissions.getAdminSubmissionList.mockResolvedValue({
      submissions: [
        {
          submission_id: 7,
          uuid: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Moose telemetry 2026',
          contributor_name: 'moose-contributor',
          submitted_timestamp: '2026-01-05T12:00:00.000Z',
          publish_timestamp: null
        }
      ],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
    mockUseApi.submissions.getAdminSubmissionUploadList.mockResolvedValue({
      uploads: [
        {
          submission_upload_id: 'upload-1',
          submission_id: 7,
          submission_name: 'Moose telemetry 2026',
          upload_id: 'upload-object-1',
          status: 'indexed',
          decision: 'approved',
          ticket_id: 'ticket-1',
          comment: null,
          create_date: '2026-01-06T12:00:00.000Z',
          create_user: 42,
          submitted_by_identifier: 'robin'
        }
      ],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens on the Submissions tab with every submission and loads no uploads', async () => {
    const { getByRole, getAllByRole, findByText, getByText } = renderContainer('/admin/submissions');

    expect(getByRole('heading', { level: 1, name: 'Submissions' })).toBeVisible();
    expect(getByRole('button', { name: 'New Submission' })).toBeVisible();
    expect(getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Submissions', 'Uploads']);
    expect(getByRole('tab', { name: 'Submissions' })).toHaveAttribute('aria-selected', 'true');

    expect(await findByText('Moose telemetry 2026')).toBeVisible();
    expect(getByText('moose-contributor')).toBeVisible();
    expect(getByText('Jan 5, 2026')).toBeVisible();
    expect(getByText('Not published')).toBeVisible();
    expect(mockUseApi.submissions.getAdminSubmissionUploadList).not.toHaveBeenCalled();
  });

  it('opens the submission page when a submission is clicked', async () => {
    const { findByText, findByTestId } = renderContainer('/admin/submissions');

    fireEvent.click(await findByText('Moose telemetry 2026'));

    expect(await findByTestId('submission-page')).toHaveTextContent('7');
  });

  it('shows the uploads of every submission when the Uploads tab is selected', async () => {
    const { getByRole, getAllByRole, findByText, getByText } = renderContainer('/admin/submissions');

    fireEvent.click(getByRole('tab', { name: 'Uploads' }));

    expect(await findByText('robin')).toBeVisible();
    expect(getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Submission',
      'Status',
      'Decision',
      'Submitted By',
      'Created'
    ]);
    expect(getByText('Moose telemetry 2026')).toBeVisible();
    expect(getByText('Indexed')).toBeVisible();
    expect(getByText('Accepted')).toBeVisible();
  });

  it('opens the upload page within its submission when an upload is clicked', async () => {
    const { findByText, findByTestId } = renderContainer('/admin/submissions?tab=uploads');

    fireEvent.click(await findByText('robin'));

    expect(await findByTestId('submission-upload-page')).toHaveTextContent('7/upload-1');
    expect(mockUseApi.submissions.getAdminSubmissionList).not.toHaveBeenCalled();
  });
});
