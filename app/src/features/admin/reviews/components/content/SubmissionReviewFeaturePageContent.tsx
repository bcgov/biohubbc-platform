import { useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { Navigate, useLocation } from 'react-router-dom';

interface SubmissionReviewFeaturePageContentProps {
  submissionId: number;
  submissionUploadId: string;
  submissionUploadReviewId: string;
  submissionFeatureId: number;
}

/**
 * Resolve an existing review feature URL to the upload-wide feature-type Properties page.
 * @param props Review scope and the feature whose type identifies the destination.
 * @returns A loading skeleton or a redirect to the type-level review page.
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
  const feature = featureQuery.data?.feature;
  const errorStatus = (featureQuery.error as APIError | null)?.status;
  if (errorStatus === 401 || errorStatus === 403) {
    return <Navigate to="/forbidden" replace />;
  }
  if (!featureQuery.isLoading && !feature) {
    return <Navigate to="/page-not-found" replace />;
  }
  const reviewPath = `/admin/submission/${submissionId}/upload/${submissionUploadId}/review/${submissionUploadReviewId}`;
  return (
    <LoadingGuard isLoading={featureQuery.isLoading} isLoadingFallback={<SkeletonPage />}>
      {feature && (
        <Navigate
          to={`${reviewPath}/feature-type/${encodeURIComponent(feature.feature_type_name)}${location.search}`}
          replace
        />
      )}
    </LoadingGuard>
  );
};
