import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SubmissionFeaturePropertiesSection } from 'components/property/SubmissionFeaturePropertiesSection';
import { SubmissionFeatureLayout } from 'features/submissions/page/features/components/SubmissionFeatureLayout';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useMemo } from 'react';
import { Navigate, Link as RouterLink, useLocation } from 'react-router-dom';
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
 *
 * Rendered with a `key` per feature, so the properties grid starts fresh for each feature.
 *
 * @param {SubmissionReviewFeaturePageContentProps} props Review and feature identifiers.
 * @returns {JSX.Element} Feature detail content.
 */
export const SubmissionReviewFeaturePageContent = (props: SubmissionReviewFeaturePageContentProps) => {
  const location = useLocation();
  const api = useApi();
  const { submissionId, submissionUploadId, submissionUploadReviewId, submissionFeatureId } = props;

  const featureQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureDetail(props, submissionFeatureId),
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadFeature(submissionId, submissionUploadId, submissionFeatureId, { signal })
  });
  const reviewQuery = useQuery({
    queryKey: submissionUploadQueryKeys.reviewDetail(props),
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadReview(submissionId, submissionUploadId, submissionUploadReviewId, { signal })
  });

  const feature = featureQuery.data?.feature;
  const review = reviewQuery.data;
  const isLoading = featureQuery.isLoading || reviewQuery.isLoading;

  const propertyGrid = useServerPaginatedGridState({ defaultSort: { field: 'property', sort: 'asc' } });
  const propertyParams = { search: propertyGrid.debouncedSearchTerm, ...propertyGrid.apiPagination };
  const propertiesQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureProperties(props, submissionFeatureId, propertyParams),
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadFeatureProperties(
        submissionId,
        submissionUploadId,
        submissionFeatureId,
        propertyParams,
        {
          signal
        }
      ),
    placeholderData: keepPreviousData
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

  const featureErrorStatus = (featureQuery.error as APIError | null)?.status;
  if (featureErrorStatus === 401 || featureErrorStatus === 403) {
    return <Navigate to="/forbidden" replace />;
  }

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
