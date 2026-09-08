import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { SubmissionFeaturePropertiesSection } from 'components/property/SubmissionFeaturePropertiesSection';
import { SubmissionFeatureDetailContent } from 'features/submissions/page/features/components/SubmissionFeatureDetailContent';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IFeaturePropertyRow, ISubmissionFeaturePropertiesResponse } from 'interfaces/useFeaturesApi.interface';
import { useEffect, useMemo } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { buildSubmissionFeaturePath, buildSubmissionPropertyValuePathResolvers, parseRouteId } from 'utils/routes';
import { type SubmissionPropertyValuePathResolvers } from 'utils/routes.interface';

/**
 * Render a feature detail page scoped to an administrative submission-upload review.
 *
 * Owns review route validation, feature loading, authorization error handling, breadcrumbs, and review-scoped content.
 *
 * @returns {JSX.Element} Administrative review feature detail page.
 */
export const SubmissionReviewFeaturePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const params = useParams<{
    submissionId: string;
    submissionUploadId: string;
    reviewScope: string;
    reviewId: string;
    submissionFeatureId: string;
  }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);
  const reviewScope =
    params.reviewScope === 'validation' || params.reviewScope === 'security' ? params.reviewScope : null;
  const isValidScope = reviewScope !== null;

  const featureDataLoader = useDataLoader(
    (id: number, uploadId: string, featureId: number) => api.admin.getSubmissionUploadFeature(id, uploadId, featureId),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );

  useEffect(() => {
    if (submissionId === null || submissionFeatureId === null || !params.submissionUploadId || !isValidScope) {
      return;
    }

    featureDataLoader.refresh(submissionId, params.submissionUploadId, submissionFeatureId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId, params.submissionUploadId, params.reviewScope]);

  const { feature } = useMemo(() => featureDataLoader.data ?? { feature: undefined }, [featureDataLoader.data]);

  const {
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
    fetcher: async (search: string, pagination: ApiPaginationRequestOptions) => {
      if (submissionId === null || submissionFeatureId === null || !params.submissionUploadId || !isValidScope) {
        return {
          properties: [],
          pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
        };
      }

      return api.admin.getSubmissionUploadFeatureProperties(
        submissionId,
        params.submissionUploadId,
        submissionFeatureId,
        {
          search,
          ...pagination
        }
      );
    },
    extractData: (response) => response.properties,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'property', sort: 'asc' },
    defaultPageSize: 10
  });

  const pathResolvers = useMemo<SubmissionPropertyValuePathResolvers>(
    () => ({
      ...buildSubmissionPropertyValuePathResolvers('/submission', location.search),
      getSubmissionFeaturePath: (targetSubmissionId, targetSubmissionFeatureId) => {
        if (targetSubmissionId !== submissionId || !params.submissionUploadId || !reviewScope || !params.reviewId) {
          return buildSubmissionFeaturePath(
            '/submission',
            targetSubmissionId,
            targetSubmissionFeatureId,
            location.search
          );
        }

        return `/admin/submission/${targetSubmissionId}/upload/${params.submissionUploadId}/review/${reviewScope}/${params.reviewId}/feature/${targetSubmissionFeatureId}${location.search}`;
      }
    }),
    [location.search, params.reviewId, params.submissionUploadId, reviewScope, submissionId]
  );

  if (
    submissionId === null ||
    submissionFeatureId === null ||
    !params.submissionUploadId ||
    !params.reviewId ||
    !isValidScope
  ) {
    return <Navigate to="/page-not-found" replace />;
  }

  const reviewPath = `/admin/submission/${submissionId}/upload/${params.submissionUploadId}/review/${reviewScope}/${params.reviewId}`;
  const scopeLabel = reviewScope === 'security' ? 'Security' : 'Validation';

  return (
    <SubmissionFeatureDetailContent
      isLoading={featureDataLoader.isLoading}
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
            {scopeLabel}
          </Link>
          <Typography color="text.primary">{feature?.feature_type_display_name}</Typography>
        </Breadcrumbs>
      }>
      <SubmissionFeaturePropertiesSection
        submissionId={submissionId}
        pathResolvers={pathResolvers}
        rows={submissionFeaturePropertyRows}
        rowCount={submissionFeaturePropertyRowCount}
        isLoading={isSubmissionFeaturePropertiesLoading}
        paginationModel={submissionFeaturePropertiesPaginationModel}
        setPaginationModel={handleSubmissionFeaturePropertiesPaginationChange}
        sortModel={submissionFeaturePropertiesSortModel}
        setSortModel={handleSubmissionFeaturePropertiesSortChange}
        searchTerm={submissionFeaturePropertiesSearchTerm}
        onSearch={handleSubmissionFeaturePropertiesSearch}
      />
    </SubmissionFeatureDetailContent>
  );
};
