import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { SubmissionReviewFeaturePage } from './SubmissionReviewFeaturePage';

vi.mock('hooks/useApi');
vi.mock('features/submissions/page/features/components/SubmissionFeatureLayout', () => ({
  SubmissionFeatureLayout: ({ breadcrumbs, children }: { breadcrumbs: React.ReactNode; children: React.ReactNode }) => (
    <>
      {breadcrumbs}
      {children}
    </>
  )
}));

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
        getSubmissionUploadFeatureProperties: getProperties
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
          id: 'feature:1',
          property: 'sample site',
          value: { urn: 'urn:16:sample_site:14', label: 'urn:16:sample_site:14' }
        },
        {
          id: 'feature:2',
          property: 'external sample site',
          value: { urn: 'urn:18:sample_site:99', label: 'urn:18:sample_site:99' }
        }
      ],
      pagination: { total: 2, current_page: 1, last_page: 1, per_page: 10 }
    });
  });

  it('loads the upload feature and renders review-scoped breadcrumbs', async () => {
    renderAt(`/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}/feature/12`);

    const breadcrumbs = screen.getByLabelText('review feature breadcrumb');
    expect(await within(breadcrumbs).findByText('Animal')).toBeInTheDocument();
    expect(getFeature).toHaveBeenCalledWith(16, submissionUploadId, 12, { signal: expect.any(AbortSignal) });
    expect(getReview).toHaveBeenCalledWith(16, submissionUploadId, submissionUploadReviewId, {
      signal: expect.any(AbortSignal)
    });
    expect(breadcrumbs).toHaveTextContent('Submission/Upload/Review/Validation/Animal');
    expect(within(breadcrumbs).getByRole('link', { name: 'Submission' })).toHaveAttribute(
      'href',
      '/admin/submissions/16'
    );
    expect(within(breadcrumbs).getByRole('link', { name: 'Validation' })).toHaveAttribute(
      'href',
      `/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}`
    );
    expect(await screen.findByRole('link', { name: 'urn:16:sample_site:14' })).toHaveAttribute(
      'href',
      `/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}/feature/14`
    );
    expect(screen.getByRole('link', { name: 'urn:18:sample_site:99' })).toHaveAttribute(
      'href',
      '/submission/18/feature/99'
    );
  });

  it.each([401, 403])('redirects to the forbidden page when the feature request fails with %i', async (status) => {
    getFeature.mockRejectedValue(Object.assign(new Error('Denied'), { status }));

    renderAt(`/admin/submission/16/upload/${submissionUploadId}/review/${submissionUploadReviewId}/feature/12`);

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });
});
