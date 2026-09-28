import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { SubmissionFeaturePropertiesSection } from 'components/property/SubmissionFeaturePropertiesSection';
import { SubmissionFeatureLayout } from 'features/submissions/page/features/components/SubmissionFeatureLayout';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IFeaturePropertyRow, ISubmissionFeaturePropertiesResponse } from 'interfaces/useFeaturesApi.interface';
import { useEffect, useMemo } from 'react';
import { Navigate, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { buildSubmissionFeaturePath, buildSubmissionPropertyValuePathResolvers } from 'utils/routes';
import { type SubmissionPropertyValuePathResolvers } from 'utils/routes.interface';

interface SubmissionReviewFeaturePageContentProps {
  submissionId: number;
  submissionUploadId: string;
  submissionUploadReviewId: string;
  submissionFeatureId: number;
}

/**
 * Load and display review-scoped feature detail.
 * @param {SubmissionReviewFeaturePageContentProps} props Review and feature identifiers.
 * @returns {JSX.Element} Feature detail content.
 */
export const SubmissionReviewFeaturePageContent = (props: SubmissionReviewFeaturePageContentProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const { submissionId, submissionUploadId, submissionUploadReviewId, submissionFeatureId } = props;

  const featureDataLoader = useDataLoader(
    (id: number, uploadId: string, featureId: number) => api.admin.getSubmissionUploadFeature(id, uploadId, featureId),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );
  const reviewDataLoader = useDataLoader(
    (currentSubmissionId: number, currentSubmissionUploadId: string, currentSubmissionUploadReviewId: string) =>
      api.admin.getSubmissionUploadReview(
        currentSubmissionId,
        currentSubmissionUploadId,
        currentSubmissionUploadReviewId
      )
  );

  useEffect(() => {
    featureDataLoader.refresh(submissionId, submissionUploadId, submissionFeatureId);
    reviewDataLoader.refresh(submissionId, submissionUploadId, submissionUploadReviewId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId, submissionUploadId, submissionUploadReviewId]);

  const { feature } = useMemo(() => featureDataLoader.data ?? { feature: undefined }, [featureDataLoader.data]);
  const review = reviewDataLoader.data;
  const isLoading = featureDataLoader.isLoading || (reviewDataLoader.isLoading && !review);

  const {
    response: submissionFeaturePropertiesResponse,
    rows: submissionFeaturePropertyRows,
    rowCount: submissionFeaturePropertyRowCount,
    isLoading: isSubmissionFeaturePropertiesLoading,
    paginationModel: submissionFeaturePropertiesPaginationModel,
    handlePaginationChange: handleSubmissionFeaturePropertiesPaginationChange,
    sortModel: submissionFeaturePropertiesSortModel,
    handleSortChange: handleSubmissionFeaturePropertiesSortChange,
    searchTerm: submissionFeaturePropertiesSearchTerm,
    handleSearch: handleSubmissionFeaturePropertiesSearch
  } = useServerPaginatedDataGrid<IFeaturePropertyRow, ISubmissionFeaturePropertiesResponse>({
    fetcher: (search: string, pagination: ApiPaginationRequestOptions) =>
      api.admin.getSubmissionUploadFeatureProperties(submissionId, submissionUploadId, submissionFeatureId, {
        search,
        ...pagination
      }),
    extractData: (response) => response.properties,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'property', sort: 'asc' },
    defaultPageSize: 10
  });

  const pathResolvers = useMemo<SubmissionPropertyValuePathResolvers>(
    () => ({
      ...buildSubmissionPropertyValuePathResolvers('/submission', location.search),
      getSubmissionFeaturePath: (targetSubmissionId, targetSubmissionFeatureId) => {
        if (targetSubmissionId !== submissionId) {
          return buildSubmissionFeaturePath(
            '/submission',
            targetSubmissionId,
            targetSubmissionFeatureId,
            location.search
          );
        }

        return `/admin/submission/${targetSubmissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}/feature/${targetSubmissionFeatureId}${location.search}`;
      }
    }),
    [location.search, submissionId, submissionUploadId, submissionUploadReviewId]
  );

  if (review?.scope && review.scope !== 'validation') {
    return <Navigate to="/page-not-found" replace />;
  }

  const reviewPath = `/admin/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}`;

  return (
    <SubmissionFeatureLayout
      isLoading={isLoading}
      feature={feature}
      rootBreadcrumbLabel="Submission"
      rootBreadcrumbTo={`/admin/submissions/${submissionId}`}
      submissionDetailBasePath="/admin/submissions"
      breadcrumbs={
        <Breadcrumbs aria-label="review feature breadcrumb">
          <Link component={RouterLink} to={`/admin/submissions/${submissionId}`} underline="hover" color="inherit">
            Submission
          </Link>
          <Typography color="inherit">Upload</Typography>
          <Typography color="inherit">Review</Typography>
          <Link component={RouterLink} to={reviewPath} underline="hover" color="inherit">
            {review?.scope === 'security' ? 'Security' : 'Validation'}
          </Link>
          <Typography color="text.primary">
            {feature ? getFeatureTypeDisplayLabel(feature.feature_type_name) : ''}
          </Typography>
        </Breadcrumbs>
      }>
      <SubmissionFeaturePropertiesSection
        submissionId={submissionId}
        pathResolvers={pathResolvers}
        rows={submissionFeaturePropertyRows}
        rowCount={submissionFeaturePropertyRowCount}
        isLoading={isSubmissionFeaturePropertiesLoading && !submissionFeaturePropertiesResponse}
        paginationModel={submissionFeaturePropertiesPaginationModel}
        setPaginationModel={handleSubmissionFeaturePropertiesPaginationChange}
        sortModel={submissionFeaturePropertiesSortModel}
        setSortModel={handleSubmissionFeaturePropertiesSortChange}
        searchTerm={submissionFeaturePropertiesSearchTerm}
        onSearch={handleSubmissionFeaturePropertiesSearch}
      />
    </SubmissionFeatureLayout>
  );
};
