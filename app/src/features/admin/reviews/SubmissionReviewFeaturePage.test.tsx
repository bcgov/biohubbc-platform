import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from 'test-helpers/test-utils';
import { SubmissionUploadReviewValidationFeatureTypePage } from './SubmissionUploadReviewValidationFeatureTypePage';
import { Mock } from 'vitest';
import { SubmissionReviewFeaturePage } from './SubmissionReviewFeaturePage';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext', () => ({ useDialogContext: () => ({ setSnackbar: vi.fn() }) }));

const submissionUploadId = '11111111-1111-4111-8111-111111111111';
const submissionUploadReviewId = '22222222-2222-4222-8222-222222222222';
const getFeature = vi.fn();
const getReview = vi.fn();
const getProperties = vi.fn();

/**
 * Renders the page at a review feature route.
 *
 * @param {string} path The route to open.
 * @returns The RTL render result.
 */
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/feature/:submissionFeatureId"
          element={<SubmissionReviewFeaturePage />}
        />
        <Route
          path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/feature-type/:featureType"
          element={<SubmissionUploadReviewValidationFeatureTypePage />}
        />
        <Route path="/page-not-found" element={<div>Not found</div>} />
        <Route path="/forbidden" element={<div>Forbidden</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('SubmissionReviewFeaturePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useApi as Mock).mockReturnValue({
      admin: {
        getSubmissionUploadFeature: getFeature,
        getSubmissionUploadReview: getReview,
        getSubmissionUploadFeatureTypeProperties: getProperties,
        getSubmissionUploadFeatureProperties: vi.fn()
      }
    });
    getFeature.mockResolvedValue({ feature: { feature_type_name: 'animal' } });
    getReview.mockResolvedValue({
      submission_upload_review_id: submissionUploadReviewId,
      submission_upload_id: submissionUploadId,
      name: 'Validation pass',
      description: 'Check features',
      scope: 'validation',
      status: 'in_progress',
      requested_by: 1
    });
    getProperties.mockResolvedValue({
      properties: [
        {
          feature_property_id: 1,
          feature_property_type_id: 1,
          name: 'count',
          display_name: 'Count',
          type_name: 'number',
          description: null,
          calculated_value: false
        }
      ]
    });
  });

  it('resolves old feature URLs to upload-wide properties without individual values or detail sections', async () => {
    renderAt(
      `/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}/feature/12?feature_type=animal`
    );
    expect(await screen.findByRole('heading', { name: 'Animal' })).toBeVisible();
    expect(await screen.findByRole('gridcell', { name: 'Count' })).toBeVisible();
    expect(getFeature).toHaveBeenCalledWith(16, submissionUploadId, 12, { signal: expect.any(AbortSignal) });
    expect(getProperties).toHaveBeenCalledWith(16, submissionUploadId, 'animal', { signal: expect.any(AbortSignal) });
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Properties' })).toBeVisible();
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'Property' })).toBeVisible();
    expect(screen.queryByText('Value')).not.toBeInTheDocument();
    expect(screen.queryByText('Map')).not.toBeInTheDocument();
    expect(screen.queryByText('About')).not.toBeInTheDocument();
    expect((useApi as Mock)().admin.getSubmissionUploadFeatureProperties).not.toHaveBeenCalled();
    const breadcrumbs = screen.getByLabelText('feature type properties breadcrumb');
    expect(within(breadcrumbs).getByRole('link', { name: 'Validation pass' })).toHaveAttribute(
      'href',
      `/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}`
    );
  });

  it.each([401, 403])('redirects to the forbidden page when the feature request fails with %i', async (status) => {
    getFeature.mockRejectedValue(Object.assign(new Error('Denied'), { status }));

    renderAt(`/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}/feature/12`);

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });
});
