import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { SubmissionUploadReviewValidationPage } from './SubmissionUploadReviewValidationPage';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext');
vi.mock('hooks/useDataLoader');
vi.mock('hooks/useServerPaginatedDataGrid');
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
vi.mock('features/submissions/components/SubmissionFeatureTable', () => ({
  SubmissionFeatureTable: ({
    rows,
    rowCount,
    onRowClick
  }: {
    rows: { submission_feature_id: number }[];
    rowCount: number;
    onRowClick?: (params: { row: { submission_feature_id: number } }) => void;
  }) => (
    <div data-testid="feature-table" data-row-count={rowCount}>
      {JSON.stringify(rows)}
      <button onClick={() => onRowClick?.({ row: rows[0] })}>Open feature</button>
    </div>
  )
}));

const submissionUploadId = '11111111-1111-4111-8111-111111111111';
const reviewId = '22222222-2222-4222-8222-222222222222';
const loadReview = vi.fn();
const loadReconciliationCounts = vi.fn();
const setReviewData = vi.fn();
const setYesNoDialog = vi.fn();
const setSnackbar = vi.fn();
const updateSubmissionUploadReview = vi.fn();

describe('SubmissionUploadReviewValidationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDialogContext as Mock).mockReturnValue({ setYesNoDialog, setSnackbar });
    (useApi as Mock).mockReturnValue({
      admin: {
        getSubmissionUploadReconciliationCounts: vi.fn(),
        getSubmissionUploadReview: vi.fn(),
        getSubmissionUploadFeatures: vi.fn(),
        updateSubmissionUploadReview
      }
    });
    const reviewLoader = {
      data: {
        submission_upload_review_id: reviewId,
        submission_upload_id: submissionUploadId,
        name: 'Validation pass',
        description: 'Check the features',
        scope: 'validation',
        status: 'in_progress',
        requested_by: 1
      },
      isLoading: false,
      load: loadReview,
      setData: setReviewData
    };
    const reconciliationLoader = {
      data: { new: 4, modified: 2, unmodified: 7 },
      isLoading: false,
      load: loadReconciliationCounts
    };
    let dataLoaderCall = 0;
    (useDataLoader as Mock).mockImplementation(() => {
      const dataLoader = dataLoaderCall % 2 === 0 ? reviewLoader : reconciliationLoader;
      dataLoaderCall += 1;
      return dataLoader;
    });
    (useServerPaginatedDataGrid as Mock).mockReturnValue({
      rows: [{ submission_feature_id: 12, feature_type_name: 'animal' }],
      rowCount: 1,
      isLoading: false,
      paginationModel: { page: 0, pageSize: 10 },
      handlePaginationChange: vi.fn(),
      sortModel: [{ field: 'submission_feature_id', sort: 'asc' }],
      handleSortChange: vi.fn()
    });
  });

  it('loads the review and renders its paginated feature list', () => {
    render(
      <MemoryRouter initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${reviewId}`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:reviewId"
            element={<SubmissionUploadReviewValidationPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(loadReview).toHaveBeenCalledWith(16, submissionUploadId, reviewId);
    expect(loadReconciliationCounts).toHaveBeenCalledWith(16, submissionUploadId);
    expect(screen.getByTestId('review-header')).toHaveTextContent('Validation pass');
    expect(screen.getByText('New')).toBeVisible();
    expect(screen.getByText('Unmodified')).toBeVisible();
    expect(screen.getByText('Modified')).toBeVisible();
    expect(screen.getByTestId('feature-table')).toHaveAttribute('data-row-count', '1');
    expect(screen.getByTestId('feature-table')).toHaveTextContent('animal');
  });

  it('confirms and completes the review without changing the upload disposition', async () => {
    updateSubmissionUploadReview.mockResolvedValue({
      submission_upload_review_id: reviewId,
      submission_upload_id: submissionUploadId,
      name: 'Validation pass',
      description: 'Check the features',
      scope: 'validation',
      status: 'completed',
      requested_by: 1
    });

    render(
      <MemoryRouter initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${reviewId}`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:reviewId"
            element={<SubmissionUploadReviewValidationPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
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
      expect(updateSubmissionUploadReview).toHaveBeenCalledWith(16, submissionUploadId, reviewId, 'completed')
    );
    expect(setReviewData).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('opens a feature within the current review route', () => {
    render(
      <MemoryRouter initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${reviewId}`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:reviewId"
            element={<SubmissionUploadReviewValidationPage />}
          />
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:reviewId/feature/:submissionFeatureId"
            element={<div>Feature detail route</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open feature' }));

    expect(screen.getByText('Feature detail route')).toBeVisible();
  });

  it('redirects to not found when the loaded review is not a validation review', async () => {
    const securityReviewLoader = {
      data: {
        submission_upload_review_id: reviewId,
        submission_upload_id: submissionUploadId,
        name: 'Security pass',
        description: 'Check access rules',
        scope: 'security',
        status: 'in_progress',
        requested_by: 1
      },
      isLoading: false,
      load: loadReview,
      setData: setReviewData
    };
    const reconciliationLoader = {
      data: { new: 4, modified: 2, unmodified: 7 },
      isLoading: false,
      load: loadReconciliationCounts
    };
    let dataLoaderCall = 0;
    (useDataLoader as Mock).mockImplementation(() => {
      const dataLoader = dataLoaderCall % 2 === 0 ? securityReviewLoader : reconciliationLoader;
      dataLoaderCall += 1;
      return dataLoader;
    });

    render(
      <MemoryRouter initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${reviewId}`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:reviewId"
            element={<SubmissionUploadReviewValidationPage />}
          />
          <Route path="/page-not-found" element={<div>Page Not Found</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Page Not Found')).toBeVisible();
  });
});
