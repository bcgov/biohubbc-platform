import { SubmissionFeaturePropertiesSection } from 'components/property/SubmissionFeaturePropertiesSection';
import { SubmissionFeatureDetailContent } from 'features/submissions/page/features/components/SubmissionFeatureDetailContent';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IFeaturePropertyRow, ISubmissionFeaturePropertiesResponse } from 'interfaces/useFeaturesApi.interface';
import { useEffect, useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { buildSubmissionPropertyValuePathResolvers, parseRouteId } from 'utils/routes';

/**
 * Portal submission feature detail page scoped to the current user's submission.
 *
 * Owns portal route parsing, feature loading, authorization error handling, and portal-scoped feature detail layout.
 *
 * @returns {JSX.Element} Portal submission feature detail page.
 */
export const PortalSubmissionFeaturePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const params = useParams<{ submissionId: string; submissionFeatureId: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);

  const featureDataLoader = useDataLoader(
    (id, featureId) => api.features.getSubmissionFeatureById(id, featureId),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );

  useEffect(() => {
    if (submissionId === null || submissionFeatureId === null) {
      return;
    }

    featureDataLoader.refresh(submissionId, submissionFeatureId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId]);

  const { feature } = useMemo(() => featureDataLoader.data ?? { feature: undefined }, [featureDataLoader.data]);
  const pathResolvers = useMemo(
    () => buildSubmissionPropertyValuePathResolvers('/portal/submission', location.search),
    [location.search]
  );

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
    fetcher: (search: string, pagination: ApiPaginationRequestOptions) => {
      if (submissionId === null || submissionFeatureId === null) {
        return Promise.resolve({
          properties: [],
          pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
        });
      }

      return api.features.getSubmissionFeatureProperties(submissionId, submissionFeatureId, {
        search,
        ...pagination
      });
    },
    extractData: (response) => response.properties,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'property', sort: 'asc' },
    defaultPageSize: 10
  });

  if (submissionId === null || submissionFeatureId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <SubmissionFeatureDetailContent
      isLoading={featureDataLoader.isLoading}
      feature={feature}
      rootBreadcrumbLabel="Portal"
      rootBreadcrumbTo="/portal/submission"
      submissionDetailBasePath="/portal/submission"
      queryString={location.search}>
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
