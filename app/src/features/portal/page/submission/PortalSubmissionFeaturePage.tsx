import { skipToken, useQuery } from '@tanstack/react-query';
import { SubmissionFeaturePropertiesSection } from 'components/property/SubmissionFeaturePropertiesSection';
import { SubmissionFeatureLayout } from 'features/submissions/page/features/components/SubmissionFeatureLayout';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useMemo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { keepPreviousDataWithin } from 'utils/query-client';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { buildSubmissionPropertyValuePathResolvers, parseRouteId } from 'utils/routes';

/**
 * Portal submission feature detail page scoped to the current user's submission.
 *
 * Owns portal route parsing, feature loading, authorization error handling, and portal-scoped feature detail layout.
 *
 * @returns {JSX.Element} Portal submission feature detail page.
 */
export const PortalSubmissionFeaturePage = () => {
  const location = useLocation();
  const api = useApi();
  const params = useParams<{ submissionId: string; submissionFeatureId: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);

  const featureQuery = useQuery({
    queryKey: submissionQueryKeys.featureDetail(submissionId ?? 0, submissionFeatureId ?? 0),
    queryFn:
      submissionId === null || submissionFeatureId === null
        ? skipToken
        : ({ signal }) => api.features.getSubmissionFeatureById(submissionId, submissionFeatureId, { signal })
  });
  const feature = featureQuery.data?.feature;
  const pathResolvers = useMemo(
    () => buildSubmissionPropertyValuePathResolvers('/portal/submission', location.search),
    [location.search]
  );

  const propertyGrid = useServerPaginatedGridState({ defaultSort: { field: 'property', sort: 'asc' } });
  const propertyParams = { search: propertyGrid.debouncedSearchTerm, ...propertyGrid.apiPagination };
  const propertiesQuery = useQuery({
    queryKey: submissionQueryKeys.featureProperties(submissionId ?? 0, submissionFeatureId ?? 0, propertyParams),
    queryFn:
      submissionId === null || submissionFeatureId === null
        ? skipToken
        : ({ signal }) =>
            api.features.getSubmissionFeatureProperties(submissionId, submissionFeatureId, propertyParams, { signal }),
    placeholderData: keepPreviousDataWithin(submissionQueryKeys.feature(submissionId ?? 0, submissionFeatureId ?? 0))
  });

  const featureErrorStatus = (featureQuery.error as APIError | null)?.status;
  if (featureErrorStatus === 401 || featureErrorStatus === 403) {
    return <Navigate to="/forbidden" replace />;
  }

  if (submissionId === null || submissionFeatureId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <SubmissionFeatureLayout
      isLoading={featureQuery.isLoading}
      feature={feature}
      rootBreadcrumbLabel="Portal"
      rootBreadcrumbTo="/portal/submission"
      submissionDetailBasePath="/portal/submission"
      queryString={location.search}>
      <SubmissionFeaturePropertiesSection
        submissionId={submissionId}
        pathResolvers={pathResolvers}
        rows={propertiesQuery.data?.properties ?? []}
        rowCount={propertiesQuery.data?.pagination.total ?? 0}
        isLoading={propertiesQuery.isFetching && !propertiesQuery.data}
        paginationModel={propertyGrid.paginationModel}
        setPaginationModel={propertyGrid.handlePaginationChange}
        sortModel={propertyGrid.sortModel}
        setSortModel={propertyGrid.handleSortChange}
        searchTerm={propertyGrid.searchTerm}
        onSearch={propertyGrid.handleSearch}
      />
    </SubmissionFeatureLayout>
  );
};
