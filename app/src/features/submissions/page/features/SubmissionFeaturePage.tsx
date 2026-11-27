import { skipToken, useQuery } from '@tanstack/react-query';
import { SubmissionFeaturePropertiesSection } from 'components/property/SubmissionFeaturePropertiesSection';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useMemo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { keepPreviousDataWithin } from 'utils/query-client';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { buildFeaturePath, buildPublicPropertyValuePathResolvers, parseRouteId } from 'utils/routes';
import { SubmissionFeatureLayout } from './components/SubmissionFeatureLayout';

/**
 * Render a public submission feature detail page, addressed by the feature alone.
 *
 * Owns route parsing, feature loading, authorization error handling, and standard submission feature properties content.
 * The feature's submission is private to its team, so the page neither names nor links to it.
 *
 * @returns {JSX.Element} Submission feature detail page.
 */
export const SubmissionFeaturePage = () => {
  const location = useLocation();
  const biohubApi = useApi();

  const params = useParams<{ submissionFeatureId: string }>();
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);

  const featureQuery = useQuery({
    queryKey: submissionQueryKeys.featureDetail(submissionFeatureId ?? 0),
    queryFn:
      submissionFeatureId === null
        ? skipToken
        : ({ signal }) => biohubApi.features.getSubmissionFeatureById(submissionFeatureId, { signal })
  });
  const feature = featureQuery.data?.feature;
  const pathResolvers = useMemo(() => buildPublicPropertyValuePathResolvers(location.search), [location.search]);

  const propertyGrid = useServerPaginatedGridState({ defaultSort: { field: 'property', sort: 'asc' } });
  const propertyParams = { search: propertyGrid.debouncedSearchTerm, ...propertyGrid.apiPagination };
  const propertiesQuery = useQuery({
    queryKey: submissionQueryKeys.featureProperties(submissionFeatureId ?? 0, propertyParams),
    queryFn:
      submissionFeatureId === null
        ? skipToken
        : ({ signal }) =>
            biohubApi.features.getSubmissionFeatureProperties(submissionFeatureId, propertyParams, { signal }),
    placeholderData: keepPreviousDataWithin(submissionQueryKeys.feature(submissionFeatureId ?? 0))
  });

  const featureErrorStatus = (featureQuery.error as APIError | null)?.status;
  if (featureErrorStatus === 401 || featureErrorStatus === 403) {
    return <Navigate to="/forbidden" replace />;
  }

  if (submissionFeatureId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <SubmissionFeatureLayout
      isLoading={featureQuery.isLoading}
      feature={feature}
      rootBreadcrumbLabel="Search"
      rootBreadcrumbTo={`/search/${location.search}`}
      getFeaturePath={(featureId) => buildFeaturePath(featureId, location.search)}>
      <SubmissionFeaturePropertiesSection
        submissionId={feature?.submission_id ?? 0}
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
