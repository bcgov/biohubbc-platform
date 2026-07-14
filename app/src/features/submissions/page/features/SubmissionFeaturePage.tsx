import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SubmissionFeatureDetailContent } from './components/SubmissionFeatureDetailContent';

export const SubmissionFeaturePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const biohubApi = useApi();

  const { submissionId, submissionFeatureId } = useParams<{ submissionId: string; submissionFeatureId: string }>();

  const featureDataLoader = useDataLoader(
    (submissionId, submissionFeatureId) =>
      biohubApi.features.getSubmissionFeatureById(submissionId, submissionFeatureId),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );
  useEffect(() => {
    featureDataLoader.refresh(submissionId, submissionFeatureId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId]);

  const { feature, relatedFeatures } = useMemo(
    () => featureDataLoader.data ?? { feature: undefined, relatedFeatures: undefined },
    [featureDataLoader.data]
  );
  const isLoading = featureDataLoader.isLoading;

  return (
    <SubmissionFeatureDetailContent
      isLoading={isLoading}
      feature={feature}
      relatedFeatures={relatedFeatures ?? []}
      submissionId={submissionId}
      submissionFeatureId={submissionFeatureId}
      rootBreadcrumbLabel="Search"
      rootBreadcrumbTo={`/search/${location.search}`}
      submissionDetailBasePath="/submission"
      featureRouteBasePath="/submission"
      queryString={location.search}
    />
  );
};
