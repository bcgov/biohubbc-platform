import { QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import { submissionUploadQueryKeys } from './submission-upload-query-keys';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { SubmissionUploadReviewValidationReconciliationPage } from './SubmissionUploadReviewValidationReconciliationPage';

vi.mock('react-router-dom', () => vi.importActual('react-router'));
const mocks = vi.hoisted(() => ({ getReview: vi.fn(), count: vi.fn(), setSnackbar: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }) }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    admin: {
      getSubmissionUploadReview: mocks.getReview,
      listSubmissionUploadFeatureTypes: mocks.count
    }
  })
}));

const uploadId = '11111111-1111-4111-8111-111111111111';
const reviewId = '22222222-2222-4222-8222-222222222222';
const reviewPath = `/admin/submission/16/upload/${uploadId}/review/${reviewId}`;
const review = {
  submission_upload_id: uploadId,
  submission_upload_review_id: reviewId,
  name: 'Validation',
  scope: 'validation'
};
const renderPage = (suffix = '/new', queryClient?: QueryClient) =>
  render(
    <MemoryRouter initialEntries={[`${reviewPath}${suffix}`]}>
      <Routes>
        <Route
          path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/:reconciliation"
          element={<SubmissionUploadReviewValidationReconciliationPage />}
        />
        <Route
          path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/:reconciliation/feature-type/:featureType"
          element={<div>Feature type properties</div>}
        />
        <Route path="/page-not-found" element={<div>Not found</div>} />
      </Routes>
    </MemoryRouter>,
    { queryClient }
  );

describe('SubmissionUploadReviewValidationReconciliationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReview.mockResolvedValue(review);
    mocks.count.mockResolvedValue({
      feature_types: [
        { feature_type_name: 'animal', count: 2 },
        { feature_type_name: 'survey', count: 1 }
      ],
      pagination: { total: 2, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  it.each([
    ['new', 'New', 'new'],
    ['unchanged', 'Unchanged', 'unmodified'],
    ['changed', 'Changed', 'modified']
  ])(
    'renders the %s outcome with a single tab, breadcrumbs, and feature types table',
    async (route, label, outcome) => {
      renderPage(`/${route}`);
      expect(await screen.findByRole('heading', { name: label })).toBeVisible();
      expect(screen.getAllByRole('tab')).toHaveLength(1);
      expect(screen.getByRole('tab', { name: 'Feature types' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Validation' })).toHaveAttribute('href', reviewPath);
      expect(screen.getByRole('link', { name: 'Submission' })).toHaveAttribute('href', '/admin/submissions/16');
      expect(await screen.findByRole('columnheader', { name: 'Feature type' })).toBeVisible();
      const animalRow = screen.getByRole('gridcell', { name: 'Animal' }).closest('[role="row"]') as HTMLElement;
      expect(within(animalRow).getByRole('gridcell', { name: '2' })).toBeVisible();
      expect(screen.getByRole('gridcell', { name: 'Survey' })).toBeVisible();
      expect(mocks.count).toHaveBeenCalledWith(
        { submissionId: 16, submissionUploadId: uploadId, reconciliation: outcome },
        { reconciliation: outcome },
        { page: 1, limit: 10, sort: 'feature_type_name', order: 'asc' },
        { signal: expect.any(AbortSignal) }
      );
    }
  );

  it('pages and sorts feature types on the server, keeping the current page visible while the next loads', async () => {
    mocks.count.mockImplementation(async (_scope, _filters, pagination) => ({
      feature_types: [{ feature_type_name: pagination.page === 2 ? 'type_11' : 'type_01', count: 1 }],
      pagination: { total: 12, current_page: pagination.page, last_page: 2, per_page: 10 }
    }));
    renderPage();
    expect(await screen.findByRole('gridcell', { name: 'Type 01' })).toBeVisible();
    expect(screen.queryByRole('gridcell', { name: 'Type 11' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(await screen.findByRole('gridcell', { name: 'Type 11' })).toBeVisible();
    expect(mocks.count).toHaveBeenLastCalledWith(
      expect.anything(),
      { reconciliation: 'new' },
      expect.objectContaining({ page: 2, limit: 10 }),
      { signal: expect.any(AbortSignal) }
    );
    fireEvent.click(screen.getByRole('columnheader', { name: 'Features' }));
    await waitFor(() =>
      expect(mocks.count).toHaveBeenLastCalledWith(
        expect.anything(),
        { reconciliation: 'new' },
        expect.objectContaining({ sort: 'count' }),
        { signal: expect.any(AbortSignal) }
      )
    );
  });

  it('opens feature-type properties from a feature type row', async () => {
    renderPage('/changed');
    fireEvent.click(await screen.findByRole('gridcell', { name: 'Animal' }));
    expect(await screen.findByText('Feature type properties')).toBeVisible();
  });

  it('renders an empty outcome', async () => {
    mocks.count.mockResolvedValue({
      feature_types: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    });
    renderPage();
    expect(await screen.findByText('No feature types found.')).toBeVisible();
  });

  it('rejects an unknown outcome without requesting review data', async () => {
    renderPage('/invalid');
    expect(await screen.findByText('Not found')).toBeVisible();
    expect(mocks.getReview).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it('rejects a cached validation review belonging to another upload', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(submissionUploadQueryKeys.reviewDetail(reviewId), {
      ...review,
      submission_upload_id: '33333333-3333-4333-8333-333333333333'
    });
    renderPage('/new', queryClient);
    expect(await screen.findByText('Not found')).toBeVisible();
    expect(mocks.getReview).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it('rejects a security review before loading reconciliation data', async () => {
    mocks.getReview.mockResolvedValue({ ...review, scope: 'security' });
    renderPage();
    expect(await screen.findByText('Not found')).toBeVisible();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it('reports failed feature type requests', async () => {
    mocks.count.mockRejectedValue(new Error('Cannot load outcome'));
    renderPage();
    expect(await screen.findByText('Unable to load feature types.')).toBeVisible();
    expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Cannot load outcome' });
  });
});
