import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { SubmissionFeaturePropertiesSection } from 'components/property/SubmissionFeaturePropertiesSection';
import { SubmissionFeatureLayout } from 'features/submissions/page/features/components/SubmissionFeatureLayout';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useMemo } from 'react';
import { Link as RouterLink, Navigate, useLocation, useParams } from 'react-router-dom';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { keepPreviousDataWithin } from 'utils/query-client';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { buildSubmissionFeaturePath, buildSubmissionPropertyValuePathResolvers, parseRouteId } from 'utils/routes';

/**
 * Portal submission feature detail page scoped to the current user's submission.
 *
 * Owns portal route parsing, submission and feature loading, authorization error handling, and portal-scoped feature
 * detail layout. The page is for the submission's team: a caller who cannot read the submission is sent to the
 * forbidden page, even when the feature itself is public.
 *
 * @returns {JSX.Element} Portal submission feature detail page.
 */
export const PortalSubmissionFeaturePage = () => {
  const location = useLocation();
  const api = useApi();
  const params = useParams<{ submissionId: string; submissionFeatureId: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);
  const isValidRoute = submissionId !== null && submissionFeatureId !== null;

  // The submission names the breadcrumb; it is private to its team, so the feature itself does not carry it.
  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(submissionId ?? 0),
    queryFn:
      !isValidRoute || submissionId === null
        ? skipToken
        : ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(submissionId, { signal })
  });
  const featureQuery = useQuery({
    queryKey: submissionQueryKeys.featureDetail(submissionFeatureId ?? 0),
    queryFn:
      !isValidRoute || submissionFeatureId === null
        ? skipToken
        : ({ signal }) => api.features.getSubmissionFeatureById(submissionFeatureId, { signal })
  });
  const feature = featureQuery.data?.feature;
  const pathResolvers = useMemo(
    () => buildSubmissionPropertyValuePathResolvers('/portal/submission', location.search),
    [location.search]
  );

  const propertyGrid = useServerPaginatedGridState({ defaultSort: { field: 'property', sort: 'asc' } });
  const propertyParams = { search: propertyGrid.debouncedSearchTerm, ...propertyGrid.apiPagination };
  const propertiesQuery = useQuery({
    queryKey: submissionQueryKeys.featureProperties(submissionFeatureId ?? 0, propertyParams),
    queryFn:
      !isValidRoute || submissionFeatureId === null
        ? skipToken
        : ({ signal }) => api.features.getSubmissionFeatureProperties(submissionFeatureId, propertyParams, { signal }),
    placeholderData: keepPreviousDataWithin(submissionQueryKeys.feature(submissionFeatureId ?? 0))
  });

  // Portal pages belong to the submission's team, so access to the submission governs the page as well as the feature.
  const submissionErrorStatus = (submissionQuery.error as APIError | null)?.status;
  const featureErrorStatus = (featureQuery.error as APIError | null)?.status;
  if ([submissionErrorStatus, featureErrorStatus].some((status) => status === 401 || status === 403)) {
    return <Navigate to="/forbidden" replace />;
  }

  // The feature is loaded by id alone, so a route pairing it with another submission names no page.
  if (submissionId === null || submissionFeatureId === null || (feature && feature.submission_id !== submissionId)) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <SubmissionFeatureLayout
      isLoading={featureQuery.isLoading}
      feature={feature}
      rootBreadcrumbLabel="Submissions"
      rootBreadcrumbTo="/portal/submission"
      getFeaturePath={(featureId) =>
        buildSubmissionFeaturePath('/portal/submission', submissionId, featureId, location.search)
      }
      breadcrumbs={
        feature && (
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} to="/portal" underline="hover" color="inherit">
              Portal
            </Link>
            <Link component={RouterLink} to="/portal/submission" underline="hover" color="inherit">
              Submissions
            </Link>
            <Link
              component={RouterLink}
              to={`/portal/submission/${submissionId}${location.search}`}
              underline="hover"
              color="inherit">
              {submissionQuery.data?.name ?? 'Submission'}
            </Link>
            <Typography color="text.primary">{getFeatureTypeDisplayLabel(feature.feature_type_name)}</Typography>
          </Breadcrumbs>
        )
      }>
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
