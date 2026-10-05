import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { SubmissionUploadReviewValidationPage } from './SubmissionUploadReviewValidationPage';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext');
vi.mock('./components/SubmissionUploadReviewHeader', () => ({
  SubmissionUploadReviewHeader: ({
    review,
    onStatusActionClick
  }: {
    review: { name: string };
    onStatusActionClick: () => void;
  }) => (
    <div data-testid="review-header">
      {review.name}
      <button onClick={onStatusActionClick}>Change status</button>
    </div>
  )
}));
// The map owns its own session and is exercised by its own suite; here we only care that the page mounts it for the
// reviewed upload. Without the stub it would reach for `useApi().martin`, which this page's api mock does not provide.
vi.mock('./components/map/SubmissionUploadMap', () => ({
  SubmissionUploadMap: ({ submissionId, submissionUploadId }: { submissionId: number; submissionUploadId: string }) => (
    <div data-testid="upload-map" data-submission-id={submissionId} data-upload-id={submissionUploadId} />
  )
}));
const submissionUploadId = '11111111-1111-4111-8111-111111111111';
const submissionUploadReviewId = '22222222-2222-4222-8222-222222222222';
const validationReview: ISubmissionUploadReviewDetail = {
  submission_upload_review_id: submissionUploadReviewId,
  submission_upload_id: submissionUploadId,
  name: 'Validation pass',
  description: 'Check the features',
  scope: 'validation',
  status: 'in_progress',
  requested_by: 1
};
const getReconciliationCounts = vi.fn();
const getSubmissionUploadFeatures = vi.fn();
const setYesNoDialog = vi.fn();
const setSnackbar = vi.fn();
const updateSubmissionUploadReview = vi.fn();

describe('SubmissionUploadReviewValidationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDialogContext as Mock).mockReturnValue({ setYesNoDialog, setSnackbar });
    (useApi as Mock).mockReturnValue({
      admin: {
        getSubmissionUploadReconciliationCounts: getReconciliationCounts,
        getSubmissionUploadFeatures,
        updateSubmissionUploadReview
      }
    });
    getReconciliationCounts.mockResolvedValue({ new: 4, modified: 2, unmodified: 7 });
  });

  it('renders the review overview without requesting or displaying a feature list', async () => {
    render(
      <MemoryRouter
        initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId"
            element={<SubmissionUploadReviewValidationPage review={validationReview} />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('review-header')).toHaveTextContent('Validation pass');
    expect(getReconciliationCounts).toHaveBeenCalledWith(16, submissionUploadId, { signal: expect.any(AbortSignal) });
    expect(screen.getByText('New')).toBeVisible();
    expect(screen.getByText('Unchanged')).toBeVisible();
    expect(screen.getByText('Changed')).toBeVisible();
    expect(screen.queryByRole('heading', { name: /^Features/ })).not.toBeInTheDocument();
    expect(getSubmissionUploadFeatures).not.toHaveBeenCalled();
  });

  it('maps the reviewed upload in its own section after the overview', async () => {
    render(
      <MemoryRouter
        initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId"
            element={<SubmissionUploadReviewValidationPage review={validationReview} />}
          />
        </Routes>
      </MemoryRouter>
    );

    const map = await screen.findByTestId('upload-map');

    expect(map).toHaveAttribute('data-submission-id', '16');
    expect(map).toHaveAttribute('data-upload-id', submissionUploadId);
    expect(screen.getByText('Map')).toBeVisible();

    // Section order: Overview, Map.
    const overview = screen.getByText('Overview');
    expect(overview.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('confirms and completes the review without changing the upload disposition', async () => {
    updateSubmissionUploadReview.mockResolvedValue({
      submission_upload_review_id: submissionUploadReviewId,
      submission_upload_id: submissionUploadId,
      name: 'Validation pass',
      description: 'Check the features',
      scope: 'validation',
      status: 'completed',
      requested_by: 1
    });

    render(
      <MemoryRouter
        initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId"
            element={<SubmissionUploadReviewValidationPage review={validationReview} />}
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Change status' }));
    expect(setYesNoDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Complete Review',
        dialogText: 'Are you sure you want to complete this review?'
      })
    );

    const confirmation = setYesNoDialog.mock.calls[0][0];
    await act(async () => confirmation.onYes());

    await waitFor(() =>
      expect(updateSubmissionUploadReview).toHaveBeenCalledWith(
        16,
        submissionUploadId,
        submissionUploadReviewId,
        'completed'
      )
    );
  });

  it('redirects to not found when the loaded review is not a validation review', async () => {
    const securityReview: ISubmissionUploadReviewDetail = {
      ...validationReview,
      name: 'Security pass',
      description: 'Check access rules',
      scope: 'security'
    };

    render(
      <MemoryRouter
        initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId"
            element={<SubmissionUploadReviewValidationPage review={securityReview} />}
          />
          <Route path="/page-not-found" element={<div>Page Not Found</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Page Not Found')).toBeVisible();
  });
});
