import { QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import { submissionUploadQueryKeys } from './submission-upload-query-keys';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { SubmissionUploadReviewValidationReconciliationPage } from './SubmissionUploadReviewValidationReconciliationPage';

vi.mock('react-router-dom', () => vi.importActual('react-router'));
const mocks = vi.hoisted(() => ({ getReview: vi.fn(), count: vi.fn(), features: vi.fn(), setSnackbar: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }) }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    admin: {
      getSubmissionUploadReview: mocks.getReview,
      countReconciliationFeatures: mocks.count,
      getReconciliationFeatures: mocks.features
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
const feature = {
  submission_feature_id: 10,
  submission_id: 16,
  uuid: 'feature-uuid',
  feature_type_id: 1,
  feature_type_name: 'animal',
  submission_name: 'Submission',
  is_secured: false,
  relevancy_score: 1,
  create_date: '2026-01-01',
  properties: { count: 42 }
};
const property = {
  feature_property_id: 1,
  feature_property_type_id: 2,
  name: 'count',
  display_name: 'Count',
  type_name: 'number',
  calculated_value: false,
  allow_multiple: false
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
          path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/feature/:featureId"
          element={<div>Feature detail</div>}
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
      total: 3,
      feature_types: [
        { feature_type_name: 'animal', count: 2 },
        { feature_type_name: 'survey', count: 1 }
      ]
    });
    mocks.features.mockImplementation(async (_scope, _type, pagination) => ({
      features: [feature],
      properties: [property],
      pagination: {
        limit: pagination.limit,
        sort: 'relevancy_score',
        order: 'desc',
        next_cursor: 'NextCursor',
        previous_cursor: null
      }
    }));
  });

  it.each([
    ['new', 'New', 'new'],
    ['unchanged', 'Unchanged', 'unmodified'],
    ['changed', 'Changed', 'modified']
  ])(
    'renders the %s outcome with a single tab, breadcrumbs, sidebar, and property table',
    async (route, label, outcome) => {
      renderPage(`/${route}`);
      expect(await screen.findByRole('heading', { name: label })).toBeVisible();
      expect(screen.getAllByRole('tab')).toHaveLength(1);
      expect(screen.getByRole('tab', { name: 'Features' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Validation' })).toHaveAttribute('href', reviewPath);
      expect(screen.getByRole('link', { name: 'Submission' })).toHaveAttribute('href', '/admin/submissions/16');
      expect(await screen.findByRole('columnheader', { name: 'Count' })).toBeVisible();
      expect(screen.getByRole('gridcell', { name: '42' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Animal' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Survey' })).toBeVisible();
      expect(mocks.count).toHaveBeenCalledWith(
        { submissionId: 16, submissionUploadId: uploadId, reconciliation: outcome },
        { signal: expect.any(AbortSignal) }
      );
      expect(screen.queryByRole('button', { name: 'Map' })).not.toBeInTheDocument();
    }
  );

  it('resets a foreign cursor when selecting the default type, pages, and resets on type change', async () => {
    renderPage('/new?feature_type=missing&cursor=ForeignCursor&limit=25');
    await waitFor(() => expect(mocks.features).toHaveBeenCalledTimes(1));
    expect(mocks.features).toHaveBeenLastCalledWith(
      expect.anything(),
      'animal',
      expect.objectContaining({ cursor: undefined, limit: 25 }),
      expect.anything()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(mocks.features).toHaveBeenLastCalledWith(
        expect.anything(),
        'animal',
        expect.objectContaining({ cursor: 'NextCursor' }),
        expect.anything()
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Survey' }));
    await waitFor(() =>
      expect(mocks.features).toHaveBeenLastCalledWith(
        expect.anything(),
        'survey',
        expect.objectContaining({ cursor: undefined }),
        expect.anything()
      )
    );
  });

  it('preserves a valid bookmarked cursor and opens feature-type properties', async () => {
    renderPage('/unchanged?feature_type=animal&cursor=SavedCursor');
    const cell = await screen.findByRole('gridcell', { name: '42' });
    expect(mocks.features).toHaveBeenLastCalledWith(
      expect.anything(),
      'animal',
      expect.objectContaining({ cursor: 'SavedCursor' }),
      expect.anything()
    );
    fireEvent.click(cell);
    expect(await screen.findByText('Feature type properties')).toBeVisible();
  });

  it('clears the cursor when sorting or changing the page size', async () => {
    renderPage('/new?feature_type=animal&cursor=SavedCursor');
    await screen.findByRole('gridcell', { name: '42' });
    fireEvent.click(screen.getByRole('button', { name: /Date/ }));
    await waitFor(() =>
      expect(mocks.features).toHaveBeenLastCalledWith(
        expect.anything(),
        'animal',
        expect.objectContaining({ cursor: undefined, sort: 'create_date', order: 'desc' }),
        expect.anything()
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(mocks.features).toHaveBeenLastCalledWith(
        expect.anything(),
        'animal',
        expect.objectContaining({ cursor: 'NextCursor' }),
        expect.anything()
      )
    );
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'rows per page' }));
    fireEvent.click(screen.getByRole('option', { name: '25' }));
    await waitFor(() =>
      expect(mocks.features).toHaveBeenLastCalledWith(
        expect.anything(),
        'animal',
        expect.objectContaining({ cursor: undefined, limit: 25 }),
        expect.anything()
      )
    );
  });

  it('reports failed feature requests without retaining rows from another type', async () => {
    renderPage();
    await screen.findByRole('gridcell', { name: '42' });
    mocks.features.mockRejectedValue(new Error('Cannot load features'));
    fireEvent.click(screen.getByRole('button', { name: 'Survey' }));
    await waitFor(() =>
      expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Cannot load features' })
    );
    expect(screen.queryByRole('gridcell', { name: '42' })).not.toBeInTheDocument();
  });

  it('opens upload feature-type properties from a property heading without selecting an individual feature', async () => {
    renderPage('/changed?feature_type=animal&cursor=SavedCursor');
    const propertyLink = await screen.findByRole('link', { name: 'Count' });
    expect(propertyLink).toHaveAttribute(
      'href',
      `${reviewPath}/changed/feature-type/animal?feature_type=animal&cursor=SavedCursor`
    );
    fireEvent.click(propertyLink);
    expect(await screen.findByText('Feature type properties')).toBeVisible();
    expect(screen.queryByText('Feature detail')).not.toBeInTheDocument();
  });

  it('renders an empty outcome without requesting a feature page', async () => {
    mocks.count.mockResolvedValue({ total: 0, feature_types: [] });
    renderPage();
    expect(await screen.findByText('No features found.')).toBeVisible();
    expect(mocks.features).not.toHaveBeenCalled();
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
    expect(mocks.features).not.toHaveBeenCalled();
  });

  it('rejects a security review before loading reconciliation data', async () => {
    mocks.getReview.mockResolvedValue({ ...review, scope: 'security' });
    renderPage();
    expect(await screen.findByText('Not found')).toBeVisible();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it('reports failed metadata requests', async () => {
    mocks.count.mockRejectedValue(new Error('Cannot load outcome'));
    renderPage();
    expect(await screen.findByText('Unable to load features.')).toBeVisible();
    expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Cannot load outcome' });
  });

  it('keeps the current property rows visible during pagination', async () => {
    renderPage();
    await screen.findByRole('gridcell', { name: '42' });
    mocks.features.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() => expect(mocks.features).toHaveBeenCalledTimes(2));
    expect(within(screen.getByRole('grid')).getByRole('gridcell', { name: '42' })).toBeVisible();
  });
});
