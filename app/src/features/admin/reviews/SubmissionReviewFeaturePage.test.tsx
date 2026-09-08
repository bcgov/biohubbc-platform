import { screen, within } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { SubmissionReviewFeaturePage } from './SubmissionReviewFeaturePage';

vi.mock('hooks/useDataLoader');
vi.mock('hooks/useServerPaginatedDataGrid');
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
const reviewId = '22222222-2222-4222-8222-222222222222';
const refreshFeature = vi.fn();
const refreshReview = vi.fn();
const handleSearch = vi.fn();

describe('SubmissionReviewFeaturePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useApi as Mock).mockReturnValue({ admin: {} });
    const featureDataLoader = {
      data: { feature: { feature_type_name: 'animal' } },
      isLoading: false,
      refresh: refreshFeature
    };
    const reviewDataLoader = {
      data: {
        submission_upload_review_id: reviewId,
        submission_upload_id: submissionUploadId,
        name: 'Validation pass',
        description: 'Check features',
        scope: 'validation',
        status: 'in_progress',
        requested_by: 1
      },
      isLoading: false,
      refresh: refreshReview
    };
    let dataLoaderCall = 0;
    (useDataLoader as Mock).mockImplementation(() => {
      const dataLoader = dataLoaderCall % 2 === 0 ? featureDataLoader : reviewDataLoader;
      dataLoaderCall += 1;
      return dataLoader;
    });
    (useServerPaginatedDataGrid as Mock).mockReturnValue({
      rows: [
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
      rowCount: 2,
      isLoading: false,
      paginationModel: { page: 0, pageSize: 10 },
      handlePaginationChange: vi.fn(),
      sortModel: [{ field: 'property', sort: 'asc' }],
      handleSortChange: vi.fn(),
      searchTerm: '',
      handleSearch
    });
  });

  it('loads the upload feature and renders review-scoped breadcrumbs', () => {
    render(
      <MemoryRouter
        initialEntries={[`/admin/submission/16/upload/${submissionUploadId}/review/${reviewId}/feature/12`]}>
        <Routes>
          <Route
            path="/admin/submission/:submissionId/upload/:submissionUploadId/review/:reviewId/feature/:submissionFeatureId"
            element={<SubmissionReviewFeaturePage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(refreshFeature).toHaveBeenCalledWith(16, submissionUploadId, 12);
    expect(refreshReview).toHaveBeenCalledWith(16, submissionUploadId, reviewId);
    const breadcrumbs = screen.getByLabelText('review feature breadcrumb');
    expect(breadcrumbs).toHaveTextContent('Submission/Upload/Review/Validation/Animal');
    expect(within(breadcrumbs).getByRole('link', { name: 'Submission' })).toHaveAttribute(
      'href',
      '/admin/submissions/16'
    );
    expect(within(breadcrumbs).getByRole('link', { name: 'Validation' })).toHaveAttribute(
      'href',
      `/admin/submission/16/upload/${submissionUploadId}/review/${reviewId}`
    );
    expect(screen.getByRole('link', { name: 'urn:16:sample_site:14' })).toHaveAttribute(
      'href',
      `/admin/submission/16/upload/${submissionUploadId}/review/${reviewId}/feature/14`
    );
    expect(screen.getByRole('link', { name: 'urn:18:sample_site:99' })).toHaveAttribute(
      'href',
      '/submission/18/feature/99'
    );
  });
});
