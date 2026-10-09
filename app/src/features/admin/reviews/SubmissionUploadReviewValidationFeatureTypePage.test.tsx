import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { SubmissionUploadReviewValidationFeatureTypePage } from './SubmissionUploadReviewValidationFeatureTypePage';

vi.mock('react-router-dom', () => vi.importActual('react-router'));
const mocks = vi.hoisted(() => ({ review: vi.fn(), properties: vi.fn(), setSnackbar: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }) }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    admin: {
      getSubmissionUploadReview: mocks.review,
      getSubmissionUploadFeatureTypeProperties: mocks.properties
    }
  })
}));
const uploadId = '11111111-1111-4111-8111-111111111111';
const reviewId = '22222222-2222-4222-8222-222222222222';
const basePath = `/admin/submission/16/upload/${uploadId}/review/${reviewId}`;
const review = {
  submission_upload_id: uploadId,
  submission_upload_review_id: reviewId,
  name: 'Validation',
  scope: 'validation'
};
const property = {
  feature_property_id: 1,
  feature_property_type_id: 2,
  name: 'count',
  display_name: 'Count',
  description: 'Number observed',
  type_name: 'number',
  calculated_value: false
};

const renderPage = (outcome = 'changed') =>
  render(
    <MemoryRouter
      initialEntries={[
        `${basePath}/${outcome ? `${outcome}/` : ''}feature-type/animal?feature_type=animal&cursor=SavedCursor`
      ]}>
      <Routes>
        <Route
          path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/:reconciliation?/feature-type/:featureType"
          element={<SubmissionUploadReviewValidationFeatureTypePage />}
        />
        <Route
          path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/:reconciliation"
          element={<div>Outcome features</div>}
        />
        <Route path="/page-not-found" element={<div>Not found</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('SubmissionUploadReviewValidationFeatureTypePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.review.mockResolvedValue(review);
    mocks.properties.mockResolvedValue({ properties: [property] });
  });

  it.each(['new', 'unchanged', 'changed'])(
    'loads upload-wide definitions from %s with a feature-type title and Properties tab',
    async (outcome) => {
      renderPage(outcome);
      expect(await screen.findByRole('heading', { name: 'Animal' })).toBeVisible();
      expect(screen.getAllByRole('tab')).toHaveLength(1);
      expect(screen.getByRole('tab', { name: 'Properties' })).toBeVisible();
      expect(screen.getByRole('heading', { name: 'Properties' })).toBeVisible();
      expect(await screen.findByRole('gridcell', { name: 'Count' })).toBeVisible();
      expect(screen.getAllByRole('columnheader')).toHaveLength(1);
      expect(screen.getByRole('columnheader', { name: 'Property' })).toBeVisible();
      expect(screen.queryByText('Map')).not.toBeInTheDocument();
      expect(screen.queryByText('About')).not.toBeInTheDocument();
      expect(mocks.properties).toHaveBeenCalledExactlyOnceWith(16, uploadId, 'animal', {
        signal: expect.any(AbortSignal)
      });
    }
  );

  it('opens directly from the review without an outcome breadcrumb', async () => {
    renderPage('');
    expect(await screen.findByRole('heading', { name: 'Animal' })).toBeVisible();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Properties' })).toBeVisible();
    expect(await screen.findByRole('gridcell', { name: 'Count' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Validation' })).toHaveAttribute('href', basePath);
    expect(screen.queryByRole('link', { name: 'Changed' })).not.toBeInTheDocument();
    expect(mocks.properties).toHaveBeenCalledExactlyOnceWith(16, uploadId, 'animal', {
      signal: expect.any(AbortSignal)
    });
  });

  it('preserves the original outcome selection and cursor in its breadcrumb', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Animal' });
    expect(screen.getByRole('link', { name: 'Submission' })).toHaveAttribute('href', '/admin/submissions/16');
    expect(screen.getByRole('link', { name: 'Validation' })).toHaveAttribute('href', basePath);
    const outcomeLink = screen.getByRole('link', { name: 'Changed' });
    expect(outcomeLink).toHaveAttribute('href', `${basePath}/changed?feature_type=animal&cursor=SavedCursor`);
    fireEvent.click(outcomeLink);
    expect(await screen.findByText('Outcome features')).toBeVisible();
  });

  it('renders the empty property state', async () => {
    mocks.properties.mockResolvedValue({ properties: [] });
    renderPage();
    expect(await screen.findByText('No properties found.')).toBeVisible();
  });

  it('reports failed property requests', async () => {
    mocks.properties.mockRejectedValue(new Error('Could not load definitions'));
    renderPage();
    expect(await screen.findByText('Unable to load properties.')).toBeVisible();
    await waitFor(() =>
      expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Could not load definitions' })
    );
  });

  it.each([
    { ...review, scope: 'security' },
    { ...review, submission_upload_id: 'another-upload' }
  ])('rejects a review outside the validation upload scope', async (invalidReview) => {
    mocks.review.mockResolvedValue(invalidReview);
    renderPage();
    expect(await screen.findByText('Not found')).toBeVisible();
    expect(mocks.properties).not.toHaveBeenCalled();
  });

  it('rejects an unknown outcome before loading review or property data', async () => {
    renderPage('invalid');
    expect(await screen.findByText('Not found')).toBeVisible();
    expect(mocks.review).not.toHaveBeenCalled();
    expect(mocks.properties).not.toHaveBeenCalled();
  });
});
